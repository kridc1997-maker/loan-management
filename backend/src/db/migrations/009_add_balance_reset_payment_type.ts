import type { Knex } from 'knex'

async function replacePaymentTypeCheck(knex: Knex, values: string[]): Promise<void> {
  const list = values.map((v) => `'${v}'`).join(',')
  await knex.raw(`
    DO $$
    DECLARE
      cname text;
    BEGIN
      SELECT con.conname INTO cname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'payments'
        AND con.contype = 'c'
        AND pg_get_constraintdef(con.oid) LIKE '%payment_type%';
      IF cname IS NOT NULL THEN
        EXECUTE format('ALTER TABLE payments DROP CONSTRAINT %I', cname);
      END IF;
    END $$;

    ALTER TABLE payments ADD CONSTRAINT payments_payment_type_check
      CHECK (payment_type IN (${list}));
  `)
}

export async function up(knex: Knex): Promise<void> {
  await replacePaymentTypeCheck(knex, ['normal', 'partial', 'rollover', 'full', 'bad_debt_recover', 'balance_reset'])
}

export async function down(knex: Knex): Promise<void> {
  await replacePaymentTypeCheck(knex, ['normal', 'partial', 'rollover', 'full', 'bad_debt_recover'])
}
