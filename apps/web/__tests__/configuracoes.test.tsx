/**
 * @jest-environment jsdom
 *
 * Unit tests for the /perfil/configuracoes surface.
 *
 *   - Schema validators (profile / password / 2FA enable+disable)
 *   - RecoveryCodes component (renders 8 codes, copy + acknowledge)
 */

import { render, screen, fireEvent } from '@testing-library/react';

import { RecoveryCodes } from '@/components/account/recovery-codes';
import {
  profileSchema,
  passwordSchema,
  enable2FASchema,
  disable2FASchema,
} from '@/lib/account-schemas';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/perfil/configuracoes',
  redirect: jest.fn(),
}));
jest.mock('@/auth', () => ({ auth: jest.fn() }));

// ---------------------------------------------------------------
// profileSchema
// ---------------------------------------------------------------

describe('profileSchema', () => {
  it('accepts a valid name and avatar URL', () => {
    expect(
      profileSchema.safeParse({
        name: 'Edi Gamer',
        avatarUrl: 'https://example.com/me.png',
      }).success,
    ).toBe(true);
  });

  it('treats empty avatarUrl as omitted (optional)', () => {
    const r = profileSchema.safeParse({ name: 'Edi', avatarUrl: '' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.avatarUrl).toBeUndefined();
  });

  it('rejects names shorter than 2 chars', () => {
    expect(profileSchema.safeParse({ name: 'X' }).success).toBe(false);
  });

  it('rejects non-http avatar URLs', () => {
    const r = profileSchema.safeParse({
      name: 'Edi',
      avatarUrl: 'javascript:alert(1)',
    });
    expect(r.success).toBe(false);
  });

  it('rejects names over 120 chars', () => {
    const long = 'a'.repeat(121);
    expect(profileSchema.safeParse({ name: long }).success).toBe(false);
  });
});

// ---------------------------------------------------------------
// passwordSchema
// ---------------------------------------------------------------

describe('passwordSchema', () => {
  const valid = {
    currentPassword: 'Old@Pass123',
    newPassword: 'New@Pass456',
    confirmPassword: 'New@Pass456',
  };

  it('accepts a strong new password matching confirmation', () => {
    expect(passwordSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects when new and confirmation differ', () => {
    const r = passwordSchema.safeParse({
      ...valid,
      confirmPassword: 'Different@99',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const msg = r.error.issues.map((i) => i.message).join(' ');
      expect(msg).toMatch(/confirmação/i);
    }
  });

  it('rejects when new password equals current', () => {
    const r = passwordSchema.safeParse({
      currentPassword: 'Same@Pass123',
      newPassword: 'Same@Pass123',
      confirmPassword: 'Same@Pass123',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const msg = r.error.issues.map((i) => i.message).join(' ');
      expect(msg).toMatch(/diferente/i);
    }
  });

  it('rejects passwords missing a digit', () => {
    expect(
      passwordSchema.safeParse({
        ...valid,
        newPassword: 'NoDigits!',
        confirmPassword: 'NoDigits!',
      }).success,
    ).toBe(false);
  });

  it('rejects passwords missing an uppercase letter', () => {
    expect(
      passwordSchema.safeParse({
        ...valid,
        newPassword: 'lowercase1',
        confirmPassword: 'lowercase1',
      }).success,
    ).toBe(false);
  });

  it('rejects passwords shorter than 8 chars', () => {
    expect(
      passwordSchema.safeParse({
        ...valid,
        newPassword: 'Sh0rt!',
        confirmPassword: 'Sh0rt!',
      }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------
// 2FA schemas
// ---------------------------------------------------------------

describe('enable2FASchema', () => {
  it('accepts a 6-digit numeric code', () => {
    expect(enable2FASchema.safeParse({ code: '482917' }).success).toBe(true);
  });
  it('rejects non-numeric input', () => {
    expect(enable2FASchema.safeParse({ code: 'abcdef' }).success).toBe(false);
  });
  it('rejects codes of wrong length', () => {
    expect(enable2FASchema.safeParse({ code: '12345' }).success).toBe(false);
    expect(enable2FASchema.safeParse({ code: '1234567' }).success).toBe(false);
  });
});

describe('disable2FASchema', () => {
  it('requires both password and 6-digit TOTP', () => {
    expect(
      disable2FASchema.safeParse({
        currentPassword: 'Pass@123',
        code: '654321',
      }).success,
    ).toBe(true);
  });
  it('rejects an empty password', () => {
    expect(
      disable2FASchema.safeParse({ currentPassword: '', code: '654321' })
        .success,
    ).toBe(false);
  });
  it('rejects a malformed code', () => {
    expect(
      disable2FASchema.safeParse({
        currentPassword: 'Pass@123',
        code: 'XX2233',
      }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------
// RecoveryCodes component
// ---------------------------------------------------------------

describe('<RecoveryCodes />', () => {
  const codes = Array.from({ length: 8 }, (_, i) =>
    `AAAA-${String(i).padStart(4, '0')}`,
  );

  it('renders all 8 codes', () => {
    const onAck = jest.fn();
    render(<RecoveryCodes codes={codes} onAcknowledge={onAck} />);
    const grid = screen.getByTestId('recovery-codes-grid');
    expect(grid.children).toHaveLength(8);
    expect(screen.getByText('AAAA-0003')).toBeInTheDocument();
  });

  it('invokes onAcknowledge when "Já guardei" is clicked', () => {
    const onAck = jest.fn();
    render(<RecoveryCodes codes={codes} onAcknowledge={onAck} />);
    fireEvent.click(screen.getByRole('button', { name: /já guardei/i }));
    expect(onAck).toHaveBeenCalledTimes(1);
  });

  it('exposes a copy button that uses the clipboard API', () => {
    const onAck = jest.fn();
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<RecoveryCodes codes={codes} onAcknowledge={onAck} />);
    fireEvent.click(screen.getByRole('button', { name: /copiar/i }));
    expect(writeText).toHaveBeenCalledWith(codes.join('\n'));
  });
});
