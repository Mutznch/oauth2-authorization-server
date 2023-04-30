# oauth2-authorization-server
Feito por: Félix A. Motelevicz

Este projeto foi feito em NodeJS e acessa as APIs da Microsoft e do Facebook e loga o usuário na aplicação com OIDC. O servidor também suporta Authorization Code Grant e Authorization Code Grant with PKCE. Possuí ambos front e backent.<br><br>

Para executar o programa, baixe o npm NodeJS se ainda não possuí. Para isso, execute a sequência de comandos abaixo no terminal:

  <li>npx --package express-generator express</li>
  <li>npm install</li><br><br>

Próximo passo, na pasta deste repositório, execute o seguinte comando para baixar todas as dependências do projeto (packege.JSON contém todas as dependências):

  <li>npm install</li><br><br>
  
Agora crie um arquivo ".env" e preencha-o com as informações presentes no ".env.example": (este arquivo deve ficar no raiz deste repositório)
<li>FACEBOOK_APP_ID=<SeuID></li>
<li>MICROSOFT_APP_ID=<SeuID></li>
  <br><br>
Pronto, basta agora executar o codigo com o comando a seguir:

  <li>npm start</li><br><br>
  
Após iniciado, acesse o aplicativo através deste link: "http://localhost:3001/"<br><br>
Este link renderiza uma página frontend onde o usuário pode escolher entre logar com facebook ou microsoft.<br><br>
Ao logar com microsoft o usuario é redirecionado para a pagina de login da microsoft e, quando logado, é redirecionado de volta. A página redirecionada mostra o id do cliente e secret do usuário, simulando uma aplicação, e são esses dados que deverão ser utilizados para testar o Authorization Code Flow.<br><br>
Ao logar com Facebook, o processo é quase o mesmo, mas como o Facebook não suporta redirecionamentos para servidores locais, o usuário é redirecionado para o 'https://oidcdebugger.com/debug' e outra página é aberta perguntando os dados obtidos no redirecionamento. Apenas coloque os dados 'id_token' e 'state' na página e o usuário será cadastrado/logado.<br><br>

As rotas para utilizar o Authorization Code Flow são as seguintes:<br>
<h5>Authorization Code Grant</h5>
<p>'http://localhost:3001/oauth/auth' para requisitar o authorization code</p>
<p>'http://localhost:3001/oauth/token' para requisitar um access token</p>
<h5>Authorization Code Grant with PKCE</h5>
<p>'http://localhost:3001/oidc/auth' para requisitar o authorization code</p>
<p>'http://localhost:3001/oidc/token' para requisitar um access token</p>

<br><br><br>
Utilize o 'https://oauthdebugger.com/' para requisitar o authorization code.<br>
Para obter o Access Token, efetue um POST na rota correta e passe o code obtido no passo anterior.<br><br>
Exemplo de request de um Access Token utilizando Axios (PKCE):<br>
```await axios.post(`http://localhost:3001/oidc/token`, {```<br>
```            grant_type: 'authorization_code',```<br>
```            code: '<YOUR_CODE>',```<br>
```            redirect_uri: 'https://oauthdebugger.com/debug',```<br>
```            code_verifier: '<CODE_VERIFIER>'```<br>
```        }, {```<br>
```            headers: {```<br>
```                'Content-Type': 'application/x-www-form-urlencoded',```<br>
```                'Authorization': `Basic ${auth}` ```<br>
```            }```<br>
```        }).catch(console.log);```<br><br>
enviar um State não é necessário.<br><br>
NOTA IMPORTANTE:<br>
<ul>
<li>Esta aplicação não possuí banco de dados e guarda todas as informações na memória, ou seja, não permite mais de um usuário logado ao mesmo tempo e reinicia-la fará com que todos os dados sejam perdidos.</li>
</ul>

