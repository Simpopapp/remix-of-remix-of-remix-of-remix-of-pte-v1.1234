opencode como runtime vs projeto real como criação

# dev-server/.opencode/project+(N) - dev-server/.opencode/prd-project+(N) - dev-server/.opencode/roadmap-proj+(N)

1- Sempre verificar se o opencode está configurado e funcionando antes de iniciar qualquer projeto (a menos que o usuário pro ativamente e explicitamente peça explicitamente para pular a verificação)

2- Sempre que um projeto novo for ser construido o opencode deve ficar fora do "app", funcionando plenamente como runtime e ainda acessivel via opencode web, porém não mais fazendo parte do preview ou das rotas do projeto em sí, a interface inicial mostrando ele é apenas para facilitar a verificação do status de atividade dele (como agente online) efuncionar como uma "blank page" antes da construção do novo projeto iniciar

3- Todo remix deve verificar se há um projeto idealizado em dev-server/.opencode/project+(N) e executa-lo - se houver, verificar também se já existe um prd completo em dev-server/.opencode/prd-project+(N) e cria-lo ou continuar ele de onde parou e para isso verificar também a evolução dele em dev-server/.opencode/roadmap-proj+(N) e criar ou seguir ele dependendo de sua existencia previa ou não. Basicamente inicie ou continue o projeto até sua conclusão antes de finalizar o remix, usando como guia de produção, verificação e atualização esses 3 arquivos principais, se nenhum deles tiver nada comece perguntando o que o usuário quer construir para dar inicio ao processo de criação
(obs: nunca use "ask" para perguntar algo ao usuário durante um remix, se estiver tudo vazio ou conluido, crie um processo de checkagem dos 3 arquivos a cada 5 minutos (por no maximo 10 tentativas), se um deles atualizar avance para o inicio ou/conclusão conforme o novo conteúdo) 

4- Em tarefas de complexidade media/alta sempre guie o agente para olhar as melhores tools e utiliza-la da melhor forma para realizar cada tipo de trabalho

## Contexto
O OpenCode é runtime/infraestrutura da sandbox (a "blank page" inicial de projeto).
Ele NÃO faz parte do produto. A interface dele não pode aparecer nas rotas
nem na navegação do app.
