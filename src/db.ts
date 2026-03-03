import pkg from 'pg';
const { Pool } = pkg;

// Configuração profissional com variáveis de ambiente e SSL obrigatório
export const pool = process.env.DB_HOST ? new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: {
    rejectUnauthorized: false // Em ambientes gerenciados (como Supabase/Neon), geralmente é false ou requer certificado
  }
}) : null;

export async function initDB() {
  if (!pool) {
    console.warn("⚠️ Variáveis de banco de dados não configuradas. Rodando em modo memória (sem persistência).");
    return;
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS jogadores (
        id UUID PRIMARY KEY,
        nickname VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS naves (
        id UUID PRIMARY KEY,
        owner_id UUID REFERENCES jogadores(id),
        seed VARCHAR(255) NOT NULL,
        vida INTEGER DEFAULT 100,
        posicao_x FLOAT DEFAULT 0,
        posicao_y FLOAT DEFAULT 0,
        posicao_z FLOAT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Banco de dados inicializado com sucesso.");
  } catch (err) {
    console.error("❌ Erro ao inicializar banco de dados:", err);
  }
}
