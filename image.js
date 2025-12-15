import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import * as fs from "fs";

dotenv.config();

const ia_definida = new GoogleGenAI({
    apiVersion : "v1alpha",
    apiKey : process.env.GEMINI_API_KEY
});

async function geradorDeImagem() {

    const respostaAI = await ia_definida.models.generateContent({
        model:"gemini-3-pro-preview",
        contents : [
            {
                parts: [
                    {text : "Extraia todas as informações ligadas a marca que está sendo apresentada no documento, destacando coloração, jeito, padrões, cores válidas, inválidas e todos os outros padrões e regras necessárias. Sobre a resposta, ela será utilizada posteriormente na geração de imagens, logo, extraia ao máximo as informações necessárias com detalhe e especificidade, de modo a construir um prompt digno para a geração de uma imagem que esteja nos conformes que o documento apresenta." },
                    {
                        inlineData : {
                            mimeType : "application/pdf",
                            data : Buffer.from(fs.readFileSync('PDFarchive/Manual Monpar Speed Brake 11_07_18.pdf')).toString('base64')
                        },
                        mediaResolution : {
                            level: "media_resolution_medium"
                        }
                    }
                ]
            }
        ]
    });

    console.log(respostaAI.text)

    if (respostaAI) {
        
        const respostaImagemIA = await ia_definida.models.generateContent({
            model: "gemini-3-pro-image-preview",
            contents: [
                { text : `Com base nesse texto, gere a imagem: ${respostaAI.text}` }
            ],
            config : {
                responseModalities : ['TEXT', 'IMAGE'],
                imageConfig : {
                    aspectRatio : "1:1",
                    imageSize : "2K",
                },
            },
        });


        for (const part of respostaImagemIA.candidates[0].content.parts) {
            if (part.text) {
                console.log(part.text);
            } else if (part.inlineData) {
                const imageData = part.inlineData.data;
                const buffer = Buffer.from(imageData, "base64");
                const nomeArquivo = "imagem_gerada.png";
                fs.writeFileSync(nomeArquivo, buffer);
                console.log('Imagem gerada com sucesso! Confira o arquivo: ', nomeArquivo);
            }
        }

    }

}

geradorDeImagem();

