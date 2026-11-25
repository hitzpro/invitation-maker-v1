import 'dotenv/config';
import pg from 'pg';

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Pemakaian: npm run make-admin -- email@contoh.com');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const res = await pool.query(
    "update users set role = 'admin' where email = $1 returning email, role",
    [email]
  );
  console.log(res.rowCount ? `Berhasil: ${res.rows[0].email} sekarang ${res.rows[0].role}` : 'User tidak ditemukan');
} finally {
  await pool.end();
}