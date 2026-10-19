// scripts/setup-db.js
// Executes SETUP_RUN_IN_SUPABASE.sql and seeds initial data via direct PostgreSQL connection.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const { Client } = pg;

// Supabase project dkqpjgptckcsxtsxyyuy is located in ap-northeast-1
const connectionString = 'postgresql://postgres.dkqpjgptckcsxtsxyyuy:azmiyaaayat@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function run() {
  console.log('Connecting to Supabase PostgreSQL in ap-northeast-1...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected successfully to Supabase DB (ap-northeast-1)!');

    const sqlPath = join(__dirname, '..', 'supabase', 'SETUP_RUN_IN_SUPABASE.sql');
    const sql = readFileSync(sqlPath, 'utf8');

    console.log('Executing SETUP_RUN_IN_SUPABASE.sql schema migration...');
    await client.query(sql);
    console.log('✅ Base schema migration executed successfully!');

    // Ensure public and admin policies are fully configured for client site & admin dashboard
    const additionalSql = `
      DO $$ BEGIN
        CREATE POLICY "Public insert enquiries" ON public.enquiries
          FOR INSERT TO anon, authenticated
          WITH CHECK (TRUE);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE POLICY "Allow anon insert portfolio" ON public.portfolio_items
          FOR INSERT TO anon, authenticated
          WITH CHECK (TRUE);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE POLICY "Allow anon update portfolio" ON public.portfolio_items
          FOR UPDATE TO anon, authenticated
          USING (TRUE) WITH CHECK (TRUE);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE POLICY "Allow anon delete portfolio" ON public.portfolio_items
          FOR DELETE TO anon, authenticated
          USING (TRUE);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE POLICY "Allow anon insert portfolio images" ON public.portfolio_images
          FOR INSERT TO anon, authenticated
          WITH CHECK (TRUE);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE POLICY "Allow anon update site_settings" ON public.site_settings
          FOR UPDATE TO anon, authenticated
          USING (TRUE) WITH CHECK (TRUE);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE POLICY "Allow anon upload storage" ON storage.objects
          FOR INSERT TO anon, authenticated
          WITH CHECK (bucket_id = 'portfolio');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE POLICY "Allow anon delete storage" ON storage.objects
          FOR DELETE TO anon, authenticated
          USING (bucket_id = 'portfolio');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `;
    await client.query(additionalSql);
    console.log('✅ Permissive RLS policies configured for studio client and portal!');

    // Check tables in public schema
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log('\nPublic tables in database:');
    res.rows.forEach(r => console.log(' - ' + r.table_name));

    // Seed default portfolio items if table is empty
    const countRes = await client.query('SELECT count(*) FROM public.portfolio_items;');
    const count = parseInt(countRes.rows[0].count, 10);
    console.log(`\nCurrent portfolio items count: ${count}`);

    if (count === 0) {
      console.log('Seeding initial portfolio items from Instagram showcase...');
      const seedSql = `
        INSERT INTO public.portfolio_items (id, slug, title, client_brand, category, description, alt_text, featured, published, sort_order)
        VALUES
        (
          'a0000000-0000-0000-0000-000000000001',
          'velvet-fig-luxury-fragrance',
          'Velvet Fig Eau de Parfum — Luxury Social Creative',
          'Artisanal Fragrances',
          'social_media',
          '"You sell the product. We design the impact." Bespoke social media visual system turning product launches into captivating, luxury brand experiences.',
          'High-end luxury perfume advertisement with gold cap, textured stone base, and soft botanical shadows',
          TRUE,
          TRUE,
          1
        ),
        (
          'a0000000-0000-0000-0000-000000000002',
          'artisan-brew-bakery-poster',
          'Artisan Brew & Bakery — Promotional Ad Poster',
          'Artisan Brew Co.',
          'posters',
          '"Your food deserves to look as irresistible as it tastes." Commercial promotional poster combining rich food photography with classical editorial typography to drive café footfall and online orders.',
          'Commercial café and bakery promotional poster featuring an iced latte, fresh croissant, and warm typography',
          TRUE,
          TRUE,
          2
        ),
        (
          'a0000000-0000-0000-0000-000000000003',
          'lumina-botanicals-ad-campaign',
          'Lumina Botanicals — Organic Radiance Ad Creative',
          'Lumina Botanicals',
          'ads',
          '"Your product deserves more than just a photo." A scroll-stopping product ad creative turning ordinary product photography into an aesthetic, premium digital billboard that demands attention in social feeds.',
          'Aesthetic skincare serum bottle with warm amber lighting and serif typography',
          TRUE,
          TRUE,
          3
        )
        ON CONFLICT (slug) DO NOTHING;

        INSERT INTO public.portfolio_images (portfolio_item_id, storage_path, image_order, width, height)
        VALUES
        ('a0000000-0000-0000-0000-000000000001', '/assets/portfolio/velvet-fig-fragrance.jpg', 1, 1200, 900),
        ('a0000000-0000-0000-0000-000000000002', '/assets/portfolio/artisan-brew-poster.jpg', 1, 1200, 900),
        ('a0000000-0000-0000-0000-000000000003', '/assets/portfolio/lumina-skincare-ad.jpg', 1, 1200, 900)
        ON CONFLICT DO NOTHING;
      `;
      await client.query(seedSql);
      console.log('✅ Seed portfolio items inserted successfully!');
    }

    console.log('\n🎉 ALL DATABASE MIGRATIONS AND SEED DATA APPLIED SUCCESSFULLY!');

  } catch (err) {
    console.error('❌ Error executing database setup:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
    console.log('Database connection closed.');
  }
}

run();
