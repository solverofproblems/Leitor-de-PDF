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



from flask import Flask, request, jsonify
import base64
import os
import fitz

def extrair_pagina_renderizada(pdf_bytes: bytes, nome_arquivo: str, dpi: int) -> dict:

    try:
        doc = fitz.open('pdf', pdf_bytes)
    except Exception as e:
        return { "status": "erro", "message": f"Erro ao abrir o PDF: {e}" }
    
    img_por_pagina = {}
    total_paginas_processadas = 0
    
    # Parâmetros de renderização
    zoom = dpi / 72
    matrix = fitz.Matrix(zoom, zoom)
    
    prefixo_name = os.path.basename(nome_arquivo).split('.')[0]

    try:
        for page_index in range(len(doc)):
            page = doc[page_index]
            page_key = f"pagina_{page_index + 1}"
            
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            
            image_bytes = pix.tobytes(output="png")
            
            base64_string = base64.b64encode(image_bytes).decode('utf-8')

            img_por_pagina[page_key] = [{
                "nome": f"{prefixo_name}_p{page_index+1}_renderizado.png",
                "extensao": "png",
                "tamanho_bytes": len(image_bytes),
                "base64_data": base64_string 
            }]

            total_paginas_processadas += 1

        doc.close()

        return {
            "status": "sucesso",
            "message": f"{total_paginas_processadas} página(s) renderizadas com sucesso em {dpi} DPI.",
            "imagens_encontradas": img_por_pagina
        }
    
    except Exception as e:
        doc.close()
        return {
            "status": "erro",
            "message": f"Erro interno ao renderizar páginas: {e}"
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


#Análise utilizando a função "extrair_pagina_renderizada":


        resultado_pixels = extrair_pagina_renderizada(dados_binarios, nome_arquivo, 300)

        return jsonify({

            "status" : "sucesso",
            "value" : resultado_pixels

        })


#Análise utilizando a função "extrair_imgPDFKV"
        # resultado = extrair_imgPDFKV(dados_binarios, nome_arquivo)

        # return jsonify({

        #     "status":"sucesso",
        #     "value" : resultado

        # })
    
    except Exception as e:

        print('Erro no processamento do Flask, veja: {}'.format(e))
        return jsonify({
            "status":"erro",
            "messagem":"Erro interno no servidor do Python! Confira: {}".format(e)
        }), 500
    
if __name__ == '__main__':
    print('Servidor Python rodando corretamente na porta 8000!')
    app.run(debug=True, port=8000)
