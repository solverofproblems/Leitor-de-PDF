import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import * as fs from "fs";

dotenv.config();

const app = express();
const PORT = 3000;

// Configurar CORS
app.use(cors());
app.use(express.json());

// Configurar multer para upload de arquivos em memória
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Inicializar Gemini AI
const ia = new GoogleGenAI({
    apiVersion: "v1alpha",
    apiKey: process.env.GEMINI_API_KEY
});

/**
 * Função para editar imagem usando Gemini AI
 * @param {Buffer} imagemOriginalBuffer - Buffer da imagem original
 * @param {Buffer} imagemDestacadaBuffer - Buffer da imagem com área destacada
 * @param {string} instrucao - Instrução do usuário sobre a modificação
 * @returns {Promise<string>} - Imagem processada em base64
 */
async function editarImagemComIA(imagemOriginalBuffer, imagemDestacadaBuffer, instrucao) {
    try {
        // Converter buffers para base64
        const imagemOriginalBase64 = imagemOriginalBuffer.toString('base64');
        const imagemDestacadaBase64 = imagemDestacadaBuffer.toString('base64');

        // Montar prompt combinando instrução do usuário com prompt base
        const promptBase = "Observe ambas as imagens. A primeira é a imagem original. A segunda destaca em branco a área que deve ser modificada. ";
        const promptCompleto = promptBase + instrucao + " Modifique a imagem conforme solicitado.";

        // Preparar array de imagens para o Gemini
        const imgArray = [
            {
                inlineData: {
                    mimeType: "image/png",
                    data: imagemOriginalBase64
                }
            },
            {
                inlineData: {
                    mimeType: "image/png",
                    data: imagemDestacadaBase64
                }
            }
        ];

        // Chamar Gemini API
        const responseAI = await ia.models.generateContent({
            model: "gemini-3-pro-image-preview",
            contents: [{ text: promptCompleto }, ...imgArray],
            config: {
                responseModalities: ['IMAGE'],
                imageConfig: {
                    aspectRatio: "1:1",
                    imageSize: "2K",
                }
            }
        });

        // Extrair imagem processada
        const imagemProcessadaBase64 = responseAI.candidates[0].content.parts[0].inlineData.data;
        
        return imagemProcessadaBase64;
    } catch (error) {
        console.error('Erro ao processar imagem com Gemini:', error);
        throw error;
    }
}

/**
 * Endpoint POST /editar-imagem
 * Recebe imagem original, imagem destacada e instrução de texto
 */
app.post('/editar-imagem', upload.fields([
    { name: 'imagemOriginal', maxCount: 1 },
    { name: 'imagemDestacada', maxCount: 1 }
]), async (req, res) => {
    try {
        // Validar arquivos recebidos
        if (!req.files || !req.files.imagemOriginal || !req.files.imagemDestacada) {
            return res.status(400).json({
                status: "erro",
                message: "É necessário enviar ambas as imagens: imagemOriginal e imagemDestacada"
            });
        }

        // Validar instrução
        const instrucao = req.body.instrucao;
        if (!instrucao || instrucao.trim() === '') {
            return res.status(400).json({
                status: "erro",
                message: "É necessário fornecer uma instrução de texto"
            });
        }

        // Obter buffers das imagens
        const imagemOriginalBuffer = req.files.imagemOriginal[0].buffer;
        const imagemDestacadaBuffer = req.files.imagemDestacada[0].buffer;

        console.log('Processando edição de imagem...');
        console.log('Instrução:', instrucao);

        // Processar imagem com Gemini AI
        const imagemProcessadaBase64 = await editarImagemComIA(
            imagemOriginalBuffer,
            imagemDestacadaBuffer,
            instrucao
        );

        // Retornar resultado
        return res.status(200).json({
            status: "sucesso",
            imagemProcessada: imagemProcessadaBase64,
            message: "Imagem processada com sucesso"
        });

    } catch (error) {
        console.error('Erro no endpoint /editar-imagem:', error);
        return res.status(500).json({
            status: "erro",
            message: error.message || "Erro ao processar imagem"
        });
    }
});

// Rota de teste
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Servidor rodando' });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});
