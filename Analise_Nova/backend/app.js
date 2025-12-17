
import express from "express";
import dotenv from 'dotenv';
import cors from 'cors';
import multer from 'multer';
const upload = multer({ dest: 'uploadsKV/' });
import * as fs from 'fs';
import axios from 'axios';


dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());



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

app.listen(5000, () => {
    console.log('Backend funcionando na porta 5000!');
});