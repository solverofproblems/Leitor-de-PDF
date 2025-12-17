
import express from "express";
import dotenv from 'dotenv';
import cors from 'cors';
import multer from 'multer';
const upload = multer({ dest: 'uploadsKV/' });
import * as fs from 'fs';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';


dotenv.config();

const app = express();

// Aumentar limite de payload para requisições grandes
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

app.use(cors());

// Armazenamento temporário de PDFs por sessão
const pdfSessions = new Map();



app.post('/enviarKV', upload.single('arquivo_para_enviar'), async (req, res) => {

    if (!req.file) {
        return res.status(400).send({ message: "Nenhum arquivo encontrado na chave 'KV'." });
    } else {

        console.log(req.file)
        const filePath = req.file.path;
        let base64String = "";

        try {

            const fileBuffer = fs.readFileSync(filePath);
            base64String = fileBuffer.toString('base64');


            const response = await axios.post('http://localhost:8000/processar-KV/', {
                base64_data: base64String,
                nome_arquivo: req.file.originalname
            });

            if (response !== undefined && response !== "" && response !== " ") {

                fs.unlinkSync(filePath);
                console.log("Arquivo convertido para Base64 e limpo do disco.");
                console.log('Deu certo, a imagem foi passada, tanto para o Python quanto para o próprio JavaScript.');


                //Próximo passo começa por aqui!!!!


                return res.status(200).send({

                    img_obj : response.data.value.imagens_encontradas,
                    message: "Arquivo recebido e convertido para uso."

                });
            } else {

                return res.status(400).send({
                    message : response.data.value
                })

            }

        } catch (error) {

            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            console.error('Erro gerado!', error)

        };
    };


});

app.post('/obter-paginas', upload.single('arquivo_para_enviar'), async (req, res) => {
    /**
     * Endpoint para obter páginas renderizadas do PDF com metadados.
     * Armazena o PDF em sessão para reutilização posterior.
     */
    if (!req.file) {
        return res.status(400).send({ 
            status: "erro",
            message: "Nenhum arquivo encontrado." 
        });
    }

    const filePath = req.file.path;
    let base64String = "";

    try {
        const fileBuffer = fs.readFileSync(filePath);
        base64String = fileBuffer.toString('base64');

        const response = await axios.post('http://localhost:8000/obter-paginas-renderizadas/', {
            base64_data: base64String,
            nome_arquivo: req.file.originalname
        });

        if (response.data && response.data.status === "sucesso") {
            // Criar sessão e armazenar PDF
            const sessionId = uuidv4();
            pdfSessions.set(sessionId, {
                base64_data: base64String,
                nome_arquivo: req.file.originalname,
                createdAt: Date.now()
            });

            // Limpar sessões antigas (mais de 1 hora)
            cleanupOldSessions();

            // Limpar arquivo temporário
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            return res.status(200).send({
                status: "sucesso",
                sessionId: sessionId,
                value: response.data.value
            });
        } else {
            // Limpar arquivo temporário em caso de erro
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            return res.status(400).send({
                status: "erro",
                message: response.data.message || "Erro ao processar PDF"
            });
        }

    } catch (error) {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        console.error('Erro ao obter páginas:', error);
        return res.status(500).send({
            status: "erro",
            message: error.message || "Erro interno do servidor"
        });
    }
});

app.post('/extrair-regioes', async (req, res) => {
    /**
     * Endpoint para extrair regiões específicas do PDF baseado em seleções do usuário.
     * Usa sessão para evitar reenviar o PDF completo.
     */
    const { sessionId, selecoes } = req.body;

    if (!sessionId || !selecoes) {
        return res.status(400).send({
            status: "erro",
            message: "Payload inválido. Esperado: sessionId, selecoes"
        });
    }

    if (!Array.isArray(selecoes) || selecoes.length === 0) {
        return res.status(400).send({
            status: "erro",
            message: "Lista de seleções vazia ou inválida."
        });
    }

    // Buscar PDF da sessão
    const session = pdfSessions.get(sessionId);
    if (!session) {
        return res.status(404).send({
            status: "erro",
            message: "Sessão não encontrada ou expirada. Por favor, faça upload do PDF novamente."
        });
    }

    try {
        const response = await axios.post('http://localhost:8000/extrair-regioes-python/', {
            base64_data: session.base64_data,
            nome_arquivo: session.nome_arquivo,
            selecoes: selecoes
        });

        if (response.data && response.data.status === "sucesso") {
            return res.status(200).send({
                status: "sucesso",
                value: response.data
            });
        } else {
            return res.status(400).send({
                status: "erro",
                message: response.data.message || "Erro ao extrair regiões"
            });
        }

    } catch (error) {
        console.error('Erro ao extrair regiões:', error);
        return res.status(500).send({
            status: "erro",
            message: error.response?.data?.message || error.message || "Erro interno do servidor"
        });
    }
});

/**
 * Limpa sessões antigas (mais de 1 hora)
 */
function cleanupOldSessions() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    for (const [sessionId, session] of pdfSessions.entries()) {
        if (session.createdAt < oneHourAgo) {
            pdfSessions.delete(sessionId);
        }
    }
}

// Limpar sessões antigas a cada 30 minutos
setInterval(cleanupOldSessions, 30 * 60 * 1000);

app.listen(5000, () => {
    console.log('Backend funcionando na porta 5000!');
});