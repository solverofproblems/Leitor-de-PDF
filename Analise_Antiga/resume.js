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
                    {text : "Sobre esse arquivo PDF, liste o que ele está tratando, destacando o que é, sua importância e os tópicos discutidos de forma detalhada. Além disso, caso exista qualquer erro ortográfico no documento, é fundamental que você indique precisamente o erro cometido, o que deveria ter sido escrito e a página exata que esse erro aconteceu. Veja que ele também destaca algumas cores... quero que você identifique as cores hexadecimais e as mostre." },
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

    console.log(respostaAI.text);

}

leitorPDF();

