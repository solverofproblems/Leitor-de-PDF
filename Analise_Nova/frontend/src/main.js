const areaImg = document.getElementById('area-img');


document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('uploadForm');

    // 1. Adiciona um "ouvinte" para o evento de SUBMIT do formulário
    form.addEventListener('submit', function (event) {

        event.preventDefault();

        const formData = new FormData(this);

        axios.post('http://localhost:5000/enviarKV', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        })
            .then(function (response) {

                const objRetornado = response.data.img_obj;

                Object.entries(objRetornado).forEach(([chavePagina, listaImagens]) => {

                    console.log(`Trabalhando a seguinte página: ${chavePagina}`)
                    listaImagens.forEach((imagem, index) => {

                        const base64String = imagem.base64_data;
                        const extensao = imagem.extensao;

                        const dataURL = `data:image/${extensao};base64,${base64String}`;

                        areaImg.innerHTML += `<img src=${dataURL}>` 


                    })


                })





                // console.log(response.data.img_obj);
            //     const imagensAgrupadas = response.data.img_obj.imagens_encontradas;
            //     const imagensProcessadas = [];

            //     const chavesDasPaginas = Object.keys(imagensAgrupadas);

            //     console.log(`Total de páginas encontradas: ${chavesDasPaginas.length}`);

            //     chavesDasPaginas.forEach(chavePagina => {
            //         // chavePagina será "pagina_1", "pagina_2", etc.
            //         const listaDeImagens = imagensAgrupadas[chavePagina];

            //         console.log(`--- Processando ${chavePagina} com ${listaDeImagens.length} imagem(ns) ---`);

            //         listaDeImagens.forEach((imagem, index) => {


            //             const base64String = imagem.base64_data;
            //             const nomeArquivo = imagem.nome;
            //             const extensao = imagem.extensao;

            //             const dataUrl = `data:image/${extensao};base64,${base64String}`;

            //             console.log(`[${chavePagina} - Imagem ${index + 1}]: ${nomeArquivo}`);
            //             console.log(`Data URL (primeiros 50 chars): ${dataUrl.substring(0, 50)}...`);

            //             // Se você precisar de uma nova estrutura de dados para o Front-end
            //             imagensProcessadas.push({
            //                 pagina: chavePagina,
            //                 nome: nomeArquivo,
            //                 dataUrl: dataUrl
            //             });

            //         });
            //     });

            // console.log(imagensProcessadas);
            })
            .catch(function (error) {
                console.log('Deu erro! Avalie: ', error.data.message);
            });

    });
});