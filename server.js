const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Serve frontend e imagens

// Banco de dados SQLite
const db = new sqlite3.Database(path.join(__dirname, 'agendamentos.db'), (err) => {
  if (err) console.error('Erro ao conectar ao banco:', err.message);
  else console.log('Conectado ao SQLite');
});

// Criar tabela se não existir
db.run(`
  CREATE TABLE IF NOT EXISTS agendamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    telefone TEXT NOT NULL,
    veiculo TEXT NOT NULL,
    tipo_servico TEXT NOT NULL,
    descricao TEXT,
    data TEXT NOT NULL,
    hora TEXT NOT NULL
  )
`);

// Número do WhatsApp do dono
const telefoneDono = '5521974438039';

// Função para gerar link do WhatsApp
function gerarLinkWhatsApp(dados) {
  const mensagem = encodeURIComponent(`
*Nome:*  ${dados.nome}

*Telefone:*  ${dados.telefone}

*Veículo:*  ${dados.veiculo}

*Serviço:*  ${dados.tipo_servico}

*Descrição:*  ${dados.descricao || 'N/A'}

*Data:*  ${dados.data}

*Hora:*  ${dados.hora}
  `);
  return `https://wa.me/${telefoneDono}?text=${mensagem}`;
}

// Rota para agendar
app.post('/agendar', (req, res) => {
  const { nome, telefone, veiculo, tipo_servico, descricao, data, hora } = req.body;

  if (!nome || !telefone || !veiculo || !tipo_servico || !data || !hora) {
    return res.status(400).json({ success: false, error: 'Campos obrigatórios faltando.' });
  }

  db.all(`SELECT COUNT(*) as count FROM agendamentos WHERE data = ?`, [data], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: 'Erro no banco de dados.' });

    const count = rows[0].count;
    if (count >= 3) return res.status(400).json({ success: false, error: 'Limite diário de 3 motos atingido para esta data.' });

    db.run(
      `INSERT INTO agendamentos (nome, telefone, veiculo, tipo_servico, descricao, data, hora) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nome, telefone, veiculo, tipo_servico, descricao || '', data, hora],
      function (err) {
        if (err) return res.status(500).json({ success: false, error: 'Erro ao salvar agendamento.' });

        const linkWhatsApp = gerarLinkWhatsApp({ nome, telefone, veiculo, tipo_servico, descricao, data, hora });
        return res.json({ success: true, message: `Agendamento confirmado para ${data} às ${hora}`, whatsapp: linkWhatsApp });
      }
    );
  });
});

// Rota para datas cheias
app.get('/datas-cheias', (req, res) => {
  db.all(
    `SELECT data, COUNT(*) as count FROM agendamentos GROUP BY data HAVING count >= 3`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, error: 'Erro no banco de dados.' });
      res.json({ success: true, datas: rows.map(r => r.data) });
    }
  );
});

// Serve index.html para qualquer outra rota
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start do servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
