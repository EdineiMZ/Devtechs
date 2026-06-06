import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RedisService } from '../redis/redis.service';
import { MercadoPagoProvider } from './mercadopago.provider';
import { PAYMENT_PROVIDER } from './payment-provider.interface';
import { StripeProvider } from './stripe.provider';

/**
 * Dynamic provider selection via `PAYMENT_PROVIDER_NAME` env var.
 * Defaults to "mercadopago". Set to "stripe" to use StripeProvider.
 */
@Global()
@Module({
  providers: [
    {
      provide: MercadoPagoProvider,
      inject: [ConfigService, RedisService],
      useFactory: (config: ConfigService, redis: RedisService) =>
        new MercadoPagoProvider(config, redis),
    },
    StripeProvider,
    {
      provide: PAYMENT_PROVIDER,
      inject: [ConfigService, MercadoPagoProvider, StripeProvider],
      useFactory: (
        config: ConfigService,
        mercadopago: MercadoPagoProvider,
        stripe: StripeProvider,
      ) => {
        const name = config.get<string>('PAYMENT_PROVIDER_NAME') ?? 'mercadopago';
        const stripeEnabled = config.get<string>('STRIPE_ENABLED') === 'true';
        if (name === 'stripe' && stripeEnabled) return stripe;
        return mercadopago;
      },
    },
  ],
  exports: [PAYMENT_PROVIDER],
})
export class PaymentProvidersModule {}
