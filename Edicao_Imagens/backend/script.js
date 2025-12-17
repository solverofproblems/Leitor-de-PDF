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
        contents: [{ text: "Deixe o moicano bem colorido e espetado e troque o fundo para um céu noturno." }, img_array],
        config: {
            responseModalities: ['IMAGE'],
            imageConfig: {
                aspectRatio: "1:1",
                imageSize: "2K",
            }

        }
    });

    fs.writeFileSync("resultado3.png", Buffer.from(responseAI.candidates[0].content.parts[0].inlineData.data, "base64")
);
    return "Deu tudo certo!"
}

const imgModificacao = {
    inlineData: {
        mimeType: "image/png",
        data: fs.readFileSync("resultado2.png").toString('base64')
    }

    // inlineData: {
    //     mimeType: "image/png",
    //     data: fs.readFileSync("img_modificacao/rosseti(modificado).png").toString('base64')
    // }

}
console.log(await edicaoImagem(imgModificacao));