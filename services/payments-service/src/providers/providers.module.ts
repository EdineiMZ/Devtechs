import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
    MercadoPagoProvider,
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
        if (name === 'stripe') return stripe;
        return mercadopago;
      },
    },
  ],
  exports: [PAYMENT_PROVIDER],
})
export class PaymentProvidersModule {}
