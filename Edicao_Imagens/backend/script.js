import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import * as fs from "fs";

dotenv.config();


const ia = new GoogleGenAI({
    apiVersion: "v1alpha",
    apiKey: process.env.GEMINI_API_KEY
});


async function edicaoImagem(img_array) {

    const responseAI = await ia.models.generateContent({

        model: "gemini-3-pro-image-preview",
        contents: [{ text: "Observe ambas as imagens. A primeira trata-se da imagem original, enquanto a segunda imagem destaca de branco a área que eu quero que seja preenchida. Sobre essa área, limpe ela, de modo a retirar o texto presente nela, além de deixar o espaço vazio harmônico com o restante da imagem." }, img_array],
        config: {
            responseModalities: ['IMAGE'],
            imageConfig: {
                aspectRatio: "1:1",
                imageSize: "2K",
            }

        }
    });

    fs.writeFileSync("resultado2.png", Buffer.from(responseAI.candidates[0].content.parts[0].inlineData.data, "base64")
);
    return "Deu tudo certo!"
}

const imgModificacao = {
    inlineData: {
        mimeType: "image/png",
        data: fs.readFileSync("img_modificacao/TOYOTA - Centro.png").toString('base64')
    },

    inlineData: {
        mimeType: "image/png",
        data: fs.readFileSync("img_modificacao/TOYOTA - Centro(modificado).png").toString('base64')
    }

}
console.log(await edicaoImagem(imgModificacao));