import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * GitHub integration: webhook HMAC verification + REST client
 * for the REST v3 endpoints we use (list repos, trigger workflow
 * dispatch, cancel run).
 *
 * Secrets:
 *   - `GITHUB_WEBHOOK_SECRET`  → shared HMAC-SHA256 key GitHub
 *                                signs every delivery with. The
 *                                same string is configured on
 *                                each webhook in the GitHub UI
 *                                under "Secret".
 *   - `GITHUB_API_TOKEN`       → personal access token or GitHub
 *                                App installation token used for
 *                                outbound REST calls.
 *
 * We NEVER log either secret. If they're missing in dev we log
 * a warning and keep running (with reduced functionality), but
 * a missing webhook secret in production makes `verifyWebhookSignature`
 * always refuse (fail-closed).
 */
@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);
  private readonly webhookSecret: string;
  private readonly apiToken: string;
  private readonly apiBase = 'https://api.github.com';
  private readonly devMode: boolean;

  constructor(config: ConfigService) {
    this.devMode = (process.env.NODE_ENV ?? 'development') !== 'production';
    this.webhookSecret = config.get<string>('GITHUB_WEBHOOK_SECRET') ?? '';
    this.apiToken = config.get<string>('GITHUB_API_TOKEN') ?? '';

    if (!this.webhookSecret) {
      this.logger.warn(
        'GITHUB_WEBHOOK_SECRET is not configured — webhook verification will refuse every delivery',
      );
    }
    if (!this.apiToken) {
      this.logger.warn(
        'GITHUB_API_TOKEN is not configured — outbound GitHub REST calls will fail',
      );
    }
  }

  // ===================================================================
  // Webhook signature verification
  // ===================================================================

  /**
   * Verify a GitHub webhook delivery's HMAC-SHA256 signature.
   *
   * GitHub signs the raw request body with the configured secret
   * and sends the result in the `X-Hub-Signature-256` header as
   * `sha256=<hex>`. We recompute the digest locally and compare
   * it to the header with `timingSafeEqual` to avoid leaking the
   * comparison outcome through timing side-channels.
   *
   * IMPORTANT: the `rawBody` argument MUST be the exact bytes
   * GitHub sent — not a re-stringified JSON. Express parses the
   * body by default, which would mutate whitespace and break
   * HMAC. The controller uses a raw-body middleware to preserve
   * the original buffer.
   *
   * @param rawBody    The untouched request body as a Buffer.
   * @param signature  The value of the X-Hub-Signature-256 header,
   *                   including the `sha256=` prefix.
   * @returns          true on match, false on mismatch or bad input.
   */
  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
    if (!this.webhookSecret) {
      // Fail-closed: no secret configured means we can't trust
      // anything, so every delivery is rejected. Dev mode gets
      // a warning from the constructor but still refuses here.
      return false;
    }
    if (!signature) {
      return false;
    }
    if (!signature.startsWith('sha256=')) {
      return false;
    }
    const providedHex = signature.slice('sha256='.length).toLowerCase();
    if (providedHex.length !== 64) {
      // A valid SHA-256 hex digest is exactly 64 chars.
      return false;
    }

    const expectedHex = createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');

    const provided = Buffer.from(providedHex, 'hex');
    const expected = Buffer.from(expectedHex, 'hex');

    // timingSafeEqual needs equal-length buffers — guard first.
    if (provided.length !== expected.length) {
      return false;
    }
    try {
      return timingSafeEqual(provided, expected);
    } catch {
      return false;
    }
  }

  /**
   * Wrapper around `verifyWebhookSignature` that throws an
   * `UnauthorizedException` instead of returning a boolean. Used
   * by the webhook controller so the rejection flows through the
   * same exception filter as other auth failures.
   */
  requireVerifiedSignature(rawBody: Buffer, signature: string | undefined): void {
    if (!this.verifyWebhookSignature(rawBody, signature)) {
      this.logger.warn('Rejected GitHub webhook — invalid HMAC signature');
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

  // ===================================================================
  // REST client
  // ===================================================================

  /** List repositories accessible to the configured API token. */
  async listRepos(params: { page?: number; perPage?: number } = {}): Promise<
    Array<{
      id: number;
      name: string;
      fullName: string;
      private: boolean;
      defaultBranch: string;
      url: string;
      owner: { login: string; avatarUrl: string };
    }>
  > {
    const page = params.page ?? 1;
    const perPage = params.perPage ?? 30;

    const res = await this.apiFetch(
      `/user/repos?sort=updated&page=${page}&per_page=${perPage}`,
    );
    if (!res.ok) {
      throw new InternalServerErrorException(
        `GitHub /user/repos returned ${res.status}`,
      );
    }
    const data = (await res.json()) as Array<Record<string, unknown>>;
    return data.map((repo) => ({
      id: repo.id as number,
      name: repo.name as string,
      fullName: repo.full_name as string,
      private: repo.private as boolean,
      defaultBranch: repo.default_branch as string,
      url: repo.html_url as string,
      owner: {
        login: (repo.owner as { login: string }).login,
        avatarUrl: (repo.owner as { avatar_url: string }).avatar_url,
      },
    }));
  }

  /**
   * Fire a workflow_dispatch event on a GitHub Actions workflow.
   * Returns true on 204 (GitHub's success code for this endpoint).
   */
  async triggerWorkflow(params: {
    owner: string;
    repo: string;
    workflowId: string;
    ref: string;
    inputs?: Record<string, string>;
  }): Promise<boolean> {
    const { owner, repo, workflowId, ref, inputs } = params;
    const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
      repo,
    )}/actions/workflows/${encodeURIComponent(workflowId)}/dispatches`;

    const res = await this.apiFetch(path, {
      method: 'POST',
      body: JSON.stringify({ ref, inputs }),
    });
    if (res.status === 204) return true;
    if (res.status === 404) {
      throw new BadRequestException(
        `Workflow ${workflowId} not found on ${owner}/${repo}`,
      );
    }
    throw new InternalServerErrorException(
      `GitHub workflow_dispatch returned ${res.status}`,
    );
  }

  /** Cancel a running workflow run (used by the rollback flow). */
  async cancelRun(params: {
    owner: string;
    repo: string;
    runId: string;
  }): Promise<boolean> {
    const { owner, repo, runId } = params;
    const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
      repo,
    )}/actions/runs/${encodeURIComponent(runId)}/cancel`;
    const res = await this.apiFetch(path, { method: 'POST' });
    return res.ok;
  }

  // -------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------

  private async apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
    if (!this.apiToken) {
      throw new InternalServerErrorException('GitHub API token is not configured');
    }
    const headers: Record<string, string> = {
      Authorization: `token ${this.apiToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'DevTechs-devops-service',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (init.body) headers['Content-Type'] = 'application/json';

    return fetch(`${this.apiBase}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
      signal: AbortSignal.timeout(10_000),
    });
  }
}
