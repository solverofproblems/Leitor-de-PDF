from flask import Flask, request, jsonify
import base64
import os
import fitz


app = Flask(__name__)


def extrair_imgPDFKV(pdf_bytes:bytes, nome_arquivo:str) -> dict:
    
    doc = fitz.open('pdf', pdf_bytes)

    img_por_pagina = {}

    total_img_extraida = 0

    saida_dir = "img_extraida"
    os.makedirs(saida_dir, exist_ok=True)

    prefixo_name = os.path.basename(nome_arquivo).split('.')[0]

    try:

        for page_index in range(len(doc)):
            page = doc[page_index]
            image_list = page.get_images(full=True)

            page_key = f"pagina_{page_index + 1}"

            img_por_pagina[page_key] = []

            for img_index, img_info in enumerate(image_list):
                xref = img_info[0]
                base_image = doc.extract_image(xref)
                image_bytes = base_image['image']
                image_ext = base_image['ext']

                base64_string = base64.b64encode(image_bytes).decode('utf-8')

                nome_imagem = f"{prefixo_name}_p{page_index+1}_{img_index}.{image_ext}"
                caminho_saida_img = os.path.join(saida_dir, nome_imagem)

                with open(caminho_saida_img, "wb") as img_files:
                    img_files.write(image_bytes)

                img_por_pagina[page_key].append({
                    "nome":nome_imagem,
                    "extensao":image_ext,
                    "arquivo_bytes":len(image_bytes),
                    "base64_data":base64_string
                })

                total_img_extraida += 1

        doc.close()

        return {
            "status":"sucesso",
            "message":f"{total_img_extraida} imagem(ns) extraídas com sucesso.",
            "imagens_encontradas":img_por_pagina
        }
    
    except fitz.EmptyDocError:
        return {
            "status":"erro",
            "message":"O arquivo PDF não é válido ou está vazio."
        }
    
    except Exception as e:
        return {
            "status" : "erro",
            "message" : f"Erro interno ao extrair imagens: {e}"
        }



@app.route('/processar-KV/', methods=['POST'])

def processar_arquivo_base64():

    dados_json = request.get_json()

    if not dados_json or 'base64_data' not in dados_json or 'nome_arquivo' not in dados_json:
        return jsonify({
            "status":"error",
            "message":"Payload JSON inválido ou incompleto."
        }), 400
    

    base64String = dados_json['base64_data']
    nome_arquivo = dados_json['nome_arquivo']

    try:

        dados_binarios = base64.b64decode(base64String)

        resultado = extrair_imgPDFKV(dados_binarios, nome_arquivo)


        # os.makedirs('arquivos_processados', exist_ok=True)
        # caminho_salvo = os.path.join('arquivos_processados', nome_arquivo)

        # with open(caminho_salvo, "wb") as fileKV:
        #     fileKV.write(dados_binarios)


        # tamanho_bytes = len(dados_binarios)

        return jsonify({

            "status":"sucesso",
            "value" : resultado

        })
    
    except Exception as e:

        print('Erro no processamento do Flask, veja: {}'.format(e))
        return jsonify({
            "status":"erro",
            "messagem":"Erro interno no servidor do Python! Confira: {}".format(e)
        }), 500
    
if __name__ == '__main__':
    print('Servidor Python rodando corretamente na porta 8000!')
    app.run(debug=True, port=8000)
