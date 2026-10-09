import type { Knex } from 'knex'

async function replaceStatusCheck(knex: Knex, values: string[]): Promise<void> {
  const list = values.map((v) => `'${v}'`).join(',')
  await knex.raw(`
    DO $$
    DECLARE
      cname text;
    BEGIN
      SELECT con.conname INTO cname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'loans'
        AND con.contype = 'c'
        AND pg_get_constraintdef(con.oid) LIKE '%status%';
      IF cname IS NOT NULL THEN
        EXECUTE format('ALTER TABLE loans DROP CONSTRAINT %I', cname);
      END IF;
    END $$;

    ALTER TABLE loans ADD CONSTRAINT loans_status_check
      CHECK (status IN (${list}));
  `)
}

export async function up(knex: Knex): Promise<void> {
  await replaceStatusCheck(knex, ['active', 'completed', 'overdue', 'bad_debt', 'written_off', 'merged'])
  // ids of the loans a debt-consolidation loan was built from (NULL for normal loans)
  await knex.schema.alterTable('loans', (t) => {
    t.jsonb('merged_from')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('loans', (t) => {
    t.dropColumn('merged_from')
  })
  await replaceStatusCheck(knex, ['active', 'completed', 'overdue', 'bad_debt', 'written_off'])
}
