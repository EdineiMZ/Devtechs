import { Global, Module } from '@nestjs/common';

import { DockerClientService } from './docker-client.service';

@Global()
@Module({
  providers: [DockerClientService],
  exports: [DockerClientService],
})
export class DockerModule {}
