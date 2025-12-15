import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import * as fs from "fs";

dotenv.config();

const ia_definida = new GoogleGenAI({
    apiVersion : "v1alpha",
    apiKey : process.env.GEMINI_API_KEY
});

async function leitorPDF() {

    const respostaAI = await ia_definida.models.generateContent({
        model:"gemini-3-pro-preview",
        contents : [
            {
                parts: [
                    {text : "O que esse PDF está falando? Sobre as perguntas, liste todas elas, transcrevendo todas, além de especificar sua resposta de forma resumida." },
                    {
                        inlineData : {
                            mimeType : "application/pdf",
                            data : Buffer.from(fs.readFileSync('PDFarchive/Questionário de Revisão - Big Data 1.pdf')).toString('base64')
                        },
                        mediaResolution : {
                            level: "media_resolution_medium"
                        }
                    }
                ]
            }
        ]
    });

    console.log(respostaAI.text);

}

leitorPDF();

