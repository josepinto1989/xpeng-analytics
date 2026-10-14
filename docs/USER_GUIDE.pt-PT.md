# Guia de utilização do XPENG Analytics

> [English version](USER_GUIDE.md)

O XPENG Analytics transforma uma exportação XPENG Data Act num painel privado
dentro do teu browser. Não existe conta da aplicação nem servidor para os dados
do veículo. Os ficheiros são processados no teu computador e permanecem apenas
no separador atual.

## 1. Antes de começar

Precisas de:

- uma exportação XPENG Data Act em ZIP, um histórico `.xpeng` guardado, ou
  ambos;
- uma versão recente do Firefox, Chrome ou Edge;
- memória livre suficiente para o período que pretendes analisar.

Outros browsers poderão funcionar, mas não são atualmente verificados. Uma
exportação de 30 dias demora normalmente cerca de um minuto num computador
recente, embora o tamanho, processador, memória e browser influenciem o tempo.

## 2. Pedir a exportação à XPENG

1. Abre o [portal XPENG Data Act](https://www.xpeng.com/data-act/my-data).
2. Pede a exportação dos dados do veículo.
3. Descarrega o ZIP quando a XPENG o disponibilizar.
4. Mantém o ZIP privado. Pode revelar horários de deslocação, hábitos de
   carregamento e outra informação sensível.

Não é necessário extrair nem modificar o ZIP.

## 3. Importar dados

Abre o [XPENG Analytics](https://josepinto1989.github.io/xpeng-analytics/) e:

- arrasta um ou vários ZIPs XPENG para a área grande de importação; ou
- clica nessa área e seleciona os ficheiros.

Podes selecionar vários ZIPs de uma só vez. Assim que o primeiro ficheiro fica
concluído, o painel completo torna-se utilizável; os totais e gráficos são
atualizados depois de cada ficheiro adicional.

Ficheiros repetidos são identificados pelo conteúdo e não são importados duas
vezes. Períodos sobrepostos são consolidados por data e hora, dando prioridade
à importação mais recente.

### Importar um histórico `.xpeng`

O mesmo importador inicial reconhece automaticamente históricos `.xpeng`. Se
selecionares um histórico juntamente com ZIPs, o histórico é restaurado
primeiro e os ZIPs são adicionados à mesma sessão local.

Só podes selecionar um histórico de cada vez. Os históricos não são
encriptados; abre apenas ficheiros em que confias.

## 4. Durante o processamento

A barra de progresso mostra a fase e o ficheiro atual. Mantém o separador aberto
até terminar. Podes cancelar uma importação ativa; a informação já aceite na
sessão continua disponível.

Fechar ou atualizar a página elimina a sessão. O XPENG Analytics não a guarda
silenciosamente no armazenamento do browser.

## 5. Navegar no painel

### Visão geral

Mostra os principais totais de distância, consumo, tempo de condução,
carregamentos e fluxos de energia. As jornadas e cargas recentes são clicáveis
e abrem diretamente o registo correspondente.

### Jornadas

Apresenta as jornadas da mais recente para a mais antiga. Seleciona uma para
consultar segmentos, consumo, velocidade, potência, SOC, autonomia indicada,
temperatura, forças de condução, pedais, comportamento do motor e pneus, quando
esses sinais existem na exportação.

Ao passar o rato num gráfico, o mesmo instante é sincronizado nos restantes
gráficos da jornada, permitindo comparar velocidade, potência, SOC, forças e
temperatura.

### Condução

Resume regeneração, tempo em movimento, aceleração, travagem e curva intensas,
distribuição de velocidade, uso do acelerador e eventos dinâmicos observados. O
perfil de condução é uma estimativa do software, não um valor oficial da XPENG
nem uma avaliação de segurança.

### Carregamentos

Mostra energia da bateria e da rede, eficiência, duração, potência, perdas
estimadas, hábitos e totais AC/DC separados. Seleciona uma sessão para consultar
a telemetria técnica.

Os quatro gráficos técnicos partilham o mesmo cursor temporal. Passa o rato em
qualquer gráfico para consultar potência, pico, SOC, tensão, corrente e
temperatura da bateria no mesmo minuto.

### Bateria

Inclui autonomia calculada, capacidade utilizável estimada, SOH relativo,
observações de SOC e temperatura, eficiência de carregamento e consumo parado.
Capacidade, SOH, autonomia e perdas são estimativas observacionais e não
leituras oficiais do BMS.

### Pneus

Mostra a evolução diária dos quatro pneus e o desequilíbrio entre os lados de
cada eixo. Usa o seletor da barra lateral para apresentar a pressão em bar ou
psi.

### Atividade

Apresenta o mapa de utilização real, energia e consumo diários, distância e
jornadas mensais, atividade por dia da semana, horas de início e carregamentos.

### Relatório

Cria localmente um PDF para as datas escolhidas. Inclui distância, consumo,
jornadas, carregamentos, energia AC/DC, regeneração, comparações úteis do
período e tabelas diárias e de carregamento.

Podes indicar:

- um preço médio da eletricidade para calcular custos estimados; e
- uma referência como condutor, empresa ou centro de custo.

O PDF é um resumo analítico, não uma fatura, recibo, documento fiscal ou
relatório oficial da XPENG.

### Qualidade

Explica que famílias e sinais estavam disponíveis nos ficheiros e identifica
observações invulgares ou incompletas. Os avisos descrevem a qualidade dos
dados; não diagnosticam o veículo.

### Dados

Permite adicionar ZIPs, substituir a sessão por um histórico, exportar a sessão
atual, consultar os ficheiros importados ou limpar a sessão.

## 6. Filtros e apresentação

A maioria das páginas permite selecionar 7, 15 ou 30 dias, todos os dados ou um
intervalo personalizado.

Os controlos no canto superior direito alternam entre inglês e português
europeu e entre tema claro e escuro. Na barra lateral podes selecionar:

- unidades métricas ou imperiais para distância, velocidade, consumo e
  temperatura;
- pressão dos pneus, separadamente, em bar ou psi.

Os novos PDFs usam também as unidades selecionadas.

## 7. Guardar a sessão em `.xpeng`

Abre **Dados** e escolhe **Exportar histórico**. O ficheiro `.xpeng` guarda o
histórico colunar já processado, permitindo normalmente restaurar a sessão mais
depressa e com menos espaço do que reconstruí-la a partir de vários ZIPs.

O ficheiro:

- permanece no teu computador, exceto se o moveres ou enviares;
- permite adicionar novos ZIPs depois de ser restaurado;
- inclui checksums para detetar corrupção;
- está comprimido, mas **não está encriptado**.

Trata-o com o mesmo cuidado que a exportação original da XPENG.

## 8. Resolução de problemas

### A importação parece lenta

- Mantém o separador visível e aguarda a conclusão da fase ou ficheiro atual.
- Fecha aplicações ou separadores que estejam a consumir muita memória.
- Usa a versão mais recente do Firefox, Chrome ou Edge.
- Importa menos ZIPs inicialmente e adiciona os restantes através de **Dados**.

### Um gráfico aparece vazio

Nem todas as exportações incluem todos os sinais. Consulta **Qualidade** e
experimenta um período mais longo.

### O ficheiro já foi importado

O mesmo conteúdo já existe na sessão. Este comportamento evita totais
duplicados.

### As horas diferem do painel de outra pessoa

Os resumos horários usam o fuso indicado pelo browser atual. Não é aplicado um
fuso fixo de Lisboa.

### Atualizei a página e os dados desapareceram

É o comportamento esperado do modelo de privacidade. Importa novamente os ZIPs
ou restaura um histórico `.xpeng`.

## 9. Privacidade, apoio e feedback

Nunca anexes um ZIP real da XPENG, histórico `.xpeng`, VIN, localização ou
captura não editada a uma issue pública.

- [Reportar um problema ou pedir uma funcionalidade](https://github.com/josepinto1989/xpeng-analytics/issues)
- [Ler as notas de privacidade](../PRIVACY.md)
- [Ler as recomendações de segurança](../SECURITY.md)
- [Apoiar o projeto no Ko-fi](https://ko-fi.com/mpinto)

O XPENG Analytics é um projeto comunitário independente criado e mantido por
Miguel Pinto. Não é afiliado, aprovado nem patrocinado pela XPENG.
