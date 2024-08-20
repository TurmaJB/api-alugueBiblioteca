const express = require('express');
const Sequelize = require('sequelize');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
    host: process.env.DB_HOST,
    dialect: 'mysql'
});

// Definição dos modelos
const Usuario = sequelize.define('Usuario', {
    nome: {
        type: Sequelize.STRING,
        allowNull: false
    },
    email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
    },
    senha: {
        type: Sequelize.STRING,
        allowNull: false
    }
}, {
    timestamps: true
});

const Livro = sequelize.define('Livro', {
    titulo: {
        type: Sequelize.STRING,
        allowNull: false
    },
    autor: {
        type: Sequelize.STRING,
        allowNull: false
    },
    quantidade: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    editora: {
        type: Sequelize.STRING,
        allowNull: false
    },
    assunto: {
        type: Sequelize.STRING,
        allowNull: false
    },
    faixaEtaria: {
        type: Sequelize.ENUM('Livre', 'Infantil', 'Infantojuvenil', 'Adulto'),
        allowNull: false
    }
}, {
    timestamps: true
});

const Emprestimo = sequelize.define('Emprestimo', {
    dataVencimento: {
        type: Sequelize.DATE,
        allowNull: false
    },
    renovações: {
        type: Sequelize.INTEGER,
        defaultValue: 0
    }
}, {
    timestamps: true
});

// Definindo relações
Usuario.hasMany(Emprestimo);
Livro.hasMany(Emprestimo);
Emprestimo.belongsTo(Usuario);
Emprestimo.belongsTo(Livro);

// Sincronização com o banco de dados
sequelize.sync().then(() => {
    console.log('Banco de dados e tabelas criados!');
});

// Rotas da API

// Rota para adicionar livros
app.post('/livros', async (req, res) => {
    try {
        const { titulo, autor, quantidade, editora, assunto, faixaEtaria } = req.body;
        const livro = await Livro.create({ titulo, autor, quantidade, editora, assunto, faixaEtaria });
        res.status(201).json(livro);
    } catch (error) {
        res.status(400).json({ erro: error.message });
    }
});

// Rota para listar livros
app.get('/livros', async (req, res) => {
    try {
        const livros = await Livro.findAll();
        res.status(200).json(livros);
    } catch (error) {
        res.status(400).json({ erro: error.message });
    }
});

// Rota para registrar usuário
app.post('/registrar', async (req, res) => {
    try {
        const { nome, email, senha } = req.body;
        const usuario = await Usuario.create({ nome, email, senha });
        res.status(201).json(usuario);
    } catch (error) {
        res.status(400).json({ erro: error.message });
    }
});

// Rota para login do usuário
app.post('/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        const usuario = await Usuario.findOne({ where: { email, senha } });
        if (usuario) {
            res.status(200).json(usuario);
        } else {
            res.status(401).json({ erro: 'Credenciais inválidas' });
        }
    } catch (error) {
        res.status(400).json({ erro: error.message });
    }
});

// Rota para alugar livros
app.post('/alugar', async (req, res) => {
    try {
        const { usuarioId, titulo, autor, editora, assunto, faixaEtaria } = req.body;
        const usuario = await Usuario.findByPk(usuarioId);
        const livro = await Livro.findOne({
            where: {
                titulo,
                autor,
                editora,
                assunto,
                faixaEtaria
            }
        });

        if (usuario && livro && livro.quantidade > 0) {
            const dataVencimento = new Date();
            dataVencimento.setDate(dataVencimento.getDate() + 7);
            const emprestimo = await Emprestimo.create({ UsuarioId: usuarioId, LivroId: livro.id, dataVencimento });
            livro.quantidade -= 1;
            await livro.save();
            res.status(201).json(emprestimo);
        } else {
            res.status(400).json({ erro: 'Usuário ou livro inválido, ou livro não disponível' });
        }
    } catch (error) {
        res.status(400).json({ erro: error.message });
    }
});

// Rota para devolver livros
app.delete('/devolver', async (req, res) => {
    try {
        const { emprestimoId } = req.body;
        const emprestimo = await Emprestimo.findByPk(emprestimoId);
        
        if (emprestimo) {
            const livro = await Livro.findByPk(emprestimo.LivroId);
            if (livro) {
                livro.quantidade += 1;
                await livro.save();
                await emprestimo.destroy();
                res.status(200).json({ mensagem: 'Livro devolvido com sucesso' });
            } else {
                res.status(400).json({ erro: 'Livro não encontrado' });
            }
        } else {
            res.status(400).json({ erro: 'ID de empréstimo inválido' });
        }
    } catch (error) {
        res.status(400).json({ erro: error.message });
    }
});

// Rota para alugar livro novamente
app.post('/renovar', async (req, res) => {
    try {
        const { usuarioId, titulo, autor, editora, assunto, faixaEtaria } = req.body;
        const usuario = await Usuario.findByPk(usuarioId);
        const livro = await Livro.findOne({
            where: {
                titulo,
                autor,
                editora,
                assunto,
                faixaEtaria
            }
        });
        
        if (usuario && livro && livro.quantidade > 0) { 
            const dataVencimento = new Date();
            dataVencimento.setDate(dataVencimento.getDate() + 7);
            const emprestimo = await Emprestimo.create({ UsuarioId: usuarioId, LivroId: livro.id, dataVencimento });
            livro.quantidade -= 1;
            await livro.save();
            res.status(201).json(emprestimo);
        } else {
            res.status(400).json({ erro: 'Usuário ou livro inválido, ou livro não disponível' });
        }
    } catch (error) {
        res.status(400).json({ erro: error.message });
    }
});

// Rota para listar livros alugados por um usuário
app.get('/usuario/:usuarioId/emprestimos', async (req, res) => {
    try {
        const { usuarioId } = req.params;
        const emprestimos = await Emprestimo.findAll({ where: { UsuarioId: usuarioId }, include: [Livro] });
        res.status(200).json(emprestimos);
    } catch (error) {
        res.status(400).json({ erro: error.message });
    }
});

// Rota para listar livros alugados com informações do usuário
app.get('/livros-alugados', async (req, res) => {
    try {
        const emprestimos = await Emprestimo.findAll({
            include: [
                { model: Usuario, attributes: ['nome', 'email'] },
                { model: Livro, attributes: ['titulo', 'autor'] }
            ]
        });
        res.status(200).json(emprestimos);
    } catch (error) {
        res.status(400).json({ erro: error.message });
    }
});

const PORT = process.env.PORT || 3750;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
