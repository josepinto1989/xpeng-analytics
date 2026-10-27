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

Em telemóveis e tablets é usado um perfil de importação com menor consumo de
memória, mantendo os mesmos dados, métricas e gráficos da versão para
computador. Em exportações grandes, mantém o browser móvel em primeiro plano.

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

### Adicionar percursos GPS opcionais

O ecrã inicial aceita exports XPENG e históricos portáteis. Depois de abrir o
painel XPENG, entra em **Dados > Adicionar mais dados**. Este único importador
aceita novos ZIPs XPENG Data Act, vários ficheiros `.gpx` ou ZIPs com GPX,
através do seletor ou por arrastar e largar. As primeiras referências testadas
são GPX 1.1 do BasicAirData GPS Logger no Android e do Open GPX Tracker no
iPhone; outras aplicações também deverão funcionar quando o GPX contém datas,
horas e coordenadas.

Antes da importação podes remover opcionalmente os primeiros e últimos 100,
250 ou 500 metros de cada percurso associado. Por predefinição não é removido
nada. A aplicação recorta as gravações pelos timestamps exatos dos trajetos
XPENG e compara cobertura temporal, distância, velocidade e qualidade. Assim,
um GPX gravado durante todo o dia pode conter várias viagens, enquanto períodos
parados, caminhadas e outros movimentos ficam excluídos do percurso mostrado
em cada viagem. Se dois telemóveis gravaram o mesmo trajeto, o melhor percurso
é escolhido automaticamente, sem gestão manual de ficheiros.

Os exports XPENG podem chegar com um dia de atraso. Por isso, uma gravação GPX
completa que ainda não tenha uma viagem correspondente fica guardada no
histórico `.xpeng` enquanto terminar nos cinco dias anteriores aos dados mais
recentes do veículo, ou for mais recente do que esses dados. Ao adicionar um
ZIP XPENG posterior, a associação é novamente tentada de forma automática.
Quando os dados do veículo já estiverem mais de cinco dias à frente de uma
gravação sem correspondência, as coordenadas deixam de entrar no export
seguinte.

O processamento GPS fica no dispositivo. As coordenadas são sensíveis e
passam a fazer parte do histórico `.xpeng` não encriptado. Protege esse
ficheiro adequadamente.

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

Escolhe **Agrupar jornadas** quando a XPENG tiver separado um único percurso em
várias jornadas. Seleciona pelo menos duas e, se quiseres, atribui um nome. O
grupo substitui essas jornadas apenas na lista principal: os separadores
permitem analisar o conjunto ou qualquer jornada original individualmente.
**Editar** altera o nome ou os membros e **Desagrupar** elimina apenas a
definição, nunca a telemetria original.

As paragens entre as jornadas escolhidas ficam incluídas na duração total. Um
carregamento cujos timestamps coincidam com uma paragem intermédia é associado
a essa paragem. O consumo e a energia de condução continuam a considerar
apenas os segmentos originais, pelo que o carregamento não é tratado como
consumo negativo. As definições são guardadas nos históricos `.xpeng`
exportados, locais e do Google Drive.

A jornada selecionada utiliza gráficos empilhados a toda a largura. A lista de
jornadas continua disponível na área de detalhe para facilitar comparações.

Ao passar o rato num gráfico, o mesmo instante é sincronizado nos restantes
gráficos da jornada, permitindo comparar velocidade, potência, SOC, forças e
temperatura.

Quando existe um GPX associado, a jornada apresenta o percurso sobre um mapa
OpenStreetMap. Abrir essa jornada faz pedidos normais dos mosaicos da área
visualizada ao fornecedor, mas o ficheiro GPX não é enviado. A atribuição
OpenStreetMap permanece visível. Ao passar o rato sobre qualquer gráfico da
jornada, o mapa assinala a posição temporalmente correspondente.

### Condução

Resume regeneração, tempo em movimento, aceleração, travagem e curva intensas,
distribuição de velocidade, uso do acelerador e eventos dinâmicos observados. O
perfil de condução é uma estimativa do software, não um valor oficial da XPENG
nem uma avaliação de segurança.

### Carregamentos

Mostra energia da bateria e da rede, eficiência, duração, potência, perdas
estimadas, hábitos e totais AC/DC separados. Seleciona uma sessão para consultar
a telemetria técnica. A lista do histórico pode ser filtrada por Todos, AC ou
DC; cores distintas identificam o tipo antes de abrir a sessão.

A telemetria de carregamento também utiliza gráficos empilhados a toda a
largura, mantendo a lista de sessões disponível para comparação rápida.

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

### Tendências

Agrega o período selecionado por mês para distância, consumo, autonomia
indicada, capacidade estimada, SOH relativo, consumo parado, carregamentos e
pressão dos pneus. Um mês pode conter apenas parte dos respetivos dados, pelo
que a cobertura deve ser considerada ao comparar meses.

A mesma página estima condução de estilo urbano, estrada e autoestrada em
pequenos blocos de telemetria. Apresenta distância, tempo, energia utilizada,
energia regenerada, consumo e confiança. É uma estimativa do software baseada
em velocidade, paragens, aceleração e travagem. Não usa GPS nem identifica a
estrada real.

### Insights

Transforma um histórico mais longo em quatro vistas analíticas locais:

- observações comparadas com o histórico do próprio carro para consumo,
  perdas parado, eficiência de carregamento, temperatura da bateria, pressão
  dos pneus ou comportamento das jornadas;
- evolução da bateria com número de amostras elegíveis, período observado e
  estado visível de confiança dos dados;
- resumo mensal automático comparado com o mês anterior comparável, com
  gráficos de movimento diário e carregamentos AC/DC; e
- comparações sazonais com um estado explícito de dados insuficientes quando os
  períodos disponíveis não são comparáveis.

Estas observações são comparações do software, não diagnósticos de avaria nem
leituras oficiais do BMS. É possível guardar resumos, comparações sazonais e
anomalias selecionadas como imagens PNG preparadas para partilha. Por
predefinição, a imagem não inclui coordenadas, percursos, nomes de ficheiros,
horas exatas ou identificadores internos.
Usa **OK** para esconder uma observação já revista. **Voltar a mostrar tudo**
recupera as observações escondidas; esta preferência não remove dados.

### Destaques de sempre

Abre uma vista em ecrã inteiro com os melhores registos observados em todo o
histórico disponível: velocidade máxima, potência máxima em kW e hp, jornada
mais longa por distância e tempo, forças de aceleração/travagem/curva,
potência de carga e energia regenerada. O tempo 0–100 km/h só aparece quando a
telemetria contém uma aceleração contínua desde praticamente parado até 100
km/h. **Guardar imagem** cria localmente um resumo PNG.

### Calendário de cobertura e pesquisa global

O calendário de cobertura indica que datas contêm jornadas, carregamentos,
telemetria estacionada, observações dos pneus ou GPS associado. Um dia vazio ou
parcial descreve apenas o histórico importado e não prova que o carro esteve
inativo.

Abre a pesquisa global na interface ou usa `Ctrl+K` (`Cmd+K` no macOS).
Pesquisa jornadas, carregamentos, datas, gráficos guardados, secções ou
definições. Usa as setas e Enter para abrir diretamente um resultado. A tecla
`/` também abre a pesquisa quando o foco não está num campo de texto.

### Reprodução visual

Apresenta num calendário as datas com jornadas registadas. Escolhe uma data e
uma jornada e inicia uma reconstrução local com reprodução, pausa, reinício,
navegação na linha temporal e velocidades 1x, 2x, 3x, 5x ou 10x. O HUD e os
gráficos sincronizados acompanham os sinais disponíveis de velocidade,
potência, pedais, bateria, direção, mudança, portas e bagageira. Sinais em falta
não são apresentados como estados medidos.

Quando existe telemetria, a reprodução inclui também o minuto imediatamente
anterior e posterior à parte em movimento. Assim, não se perdem eventos como
abrir uma porta ou a bagageira antes de arrancar ou depois de chegar. As fases
de abertura e fecho da bagageira e o movimento ativo dos vidros são mostrados
a partir dos respetivos códigos registados; não são apresentados como uma
percentagem exata de abertura.

Quando a jornada tem um percurso GPX associado, o marcador do mapa acompanha a
reprodução pelos timestamps. Sem GPX, a reprodução continua com a telemetria
XPENG. Intervalos longos sem dados são encurtados e identificados. O veículo é
uma visualização 2.5D genérica e original, não um modelo XPENG nem um simulador
com precisão de segurança. As rodas dianteiras acompanham a direção observada e
as luzes de travagem usam o sinal real do travão. Como a exportação não fornece
atualmente o estado das luzes, os médios são uma aproximação visual entre as
20:00 e as 08:00. No telemóvel, os mesmos dados usam uma composição vertical
mais leve.

### Os meus gráficos

Cria visualizações pessoais com a informação já processada no browser. Escolhe
um grupo de dados, tipo de gráfico, eixo horizontal, até três métricas, período
e, quando fizer sentido, agrupamento diário ou mensal. A pré-visualização é
atualizada enquanto editas. Estão disponíveis gráficos de linhas, área, barras,
dispersão e histogramas quando os campos selecionados o permitem.

Os gráficos guardados podem ser editados, duplicados, reordenados ou eliminados.
As escolhas Métrico/Imperial e bar/psi são aplicadas no momento da apresentação.
O `.xpeng` guarda apenas a definição compacta, sem imagens nem telemetria
duplicada. Se um histórico futuro não tiver uma métrica usada, o gráfico
mantém-se guardado e apresenta um aviso claro de dados indisponíveis.

### Relatório

Cria localmente um PDF para as datas escolhidas. Inclui distância, consumo,
jornadas, carregamentos, energia AC/DC, regeneração, comparações úteis do
período e tabelas diárias e de carregamento.

Podes indicar:

- um preço médio da eletricidade para calcular custos estimados; e
- uma referência como condutor, empresa ou centro de custo.

Se existirem jornadas com GPX no período, podes incluir os respetivos traçados
no PDF. Estes diagramas são compostos localmente e não descarregam um mapa de
fundo online.

O PDF é um resumo analítico, não uma fatura, recibo, documento fiscal ou
relatório oficial da XPENG.

### Qualidade

Explica que famílias e sinais estavam disponíveis nos ficheiros e identifica
observações invulgares ou incompletas. Os avisos descrevem a qualidade dos
dados; não diagnosticam o veículo. Os alertas começam recolhidos. Os alertas
de avanço do odómetro mostram data, intervalo e quilómetros afetados. Podem ser
ignorados individualmente, limpos em conjunto e restaurados depois sem apagar
nem alterar o histórico do carro.

### Dados

Permite adicionar ZIPs XPENG e percursos GPX no mesmo importador, consultar o
resumo das associações GPS automáticas, substituir a sessão por um histórico,
exportar a sessão atual, consultar os
ficheiros importados ou limpar a sessão. Inclui também os controlos opcionais
de histórico local persistente.

## 6. Filtros e apresentação

A maioria das páginas permite selecionar 7, 15 ou 30 dias, todos os dados ou um
intervalo personalizado.

Abre **Definições** na parte inferior da barra lateral do computador ou no
cabeçalho do painel em ecrãs mais pequenos. O mesmo painel permite selecionar:

- unidades métricas ou imperiais para distância, velocidade, consumo e
  temperatura;
- pressão dos pneus, separadamente, em bar ou psi.

Os novos PDFs usam também as unidades selecionadas.

### Guia inicial

Na primeira visita, o guia opcional explica a exportação XPENG, o processamento
local e as principais áreas do painel. Pode ser ignorado e reiniciado em
**Definições** a qualquer momento. Um histórico `.xpeng` atual não interrompe
um utilizador recorrente; um histórico antigo pode apresentar uma vez as novas
áreas da versão 2.0. Só é guardada localmente a escolha de conclusão ou omissão.

## 7. Guardar a sessão em `.xpeng`

Abre **Dados** e escolhe **Exportar histórico**. O ficheiro `.xpeng` guarda o
histórico colunar já processado, permitindo normalmente restaurar a sessão mais
depressa e com menos espaço do que reconstruí-la a partir de vários ZIPs.

O ficheiro:

- permanece no teu computador, exceto se o moveres ou enviares;
- permite adicionar novos ZIPs depois de ser restaurado;
- inclui checksums para detetar corrupção;
- preserva os recortes GPS associados automaticamente e as gravações GPX
  completas recentes que ainda aguardam dados XPENG atrasados;
- preserva as definições validadas dos gráficos pessoais;
- está comprimido, mas **não está encriptado**.

Os históricos atuais usam blocos mensais internos. Os totais, tendências e
índices de viagens/carregamentos abrem a partir de resumos compactos; os
gráficos detalhados, mapas e telemetria do replay só são carregados quando
selecionas o respetivo registo. As versões `.xpeng` anteriores são migradas
localmente na primeira abertura e a exportação seguinte usa esta estrutura
preparada para históricos longos.

Trata-o com o mesmo cuidado que a exportação original da XPENG.

### Guardar o histórico neste browser

Abre **Dados** e ativa **Guardar este histórico neste dispositivo**. Esta opção
está desligada por predefinição. Depois de ativada, a aplicação cria o mesmo
histórico `.xpeng` processado e guarda uma cópia no armazenamento IndexedDB
privado do browser. Na visita seguinte, usando o mesmo perfil do browser, o
histórico é aberto automaticamente. Novos ZIPs substituem a cópia guardada
apenas depois de serem processados e deduplicados com sucesso.

A página Dados mostra o espaço utilizado, a última gravação e a última
importação. Também podes ativar um lembrete local e escolher um intervalo de 7,
15, 25 ou 30 dias. A data calculada para o próximo lembrete aparece ao lado do
intervalo. O lembrete não acede à conta XPENG nem descarrega ficheiros
automaticamente.

Usa **Eliminar histórico guardado** para apagar essa cópia. Como o browser ou o
sistema operativo podem limpar o armazenamento local, mantém um ficheiro
`.xpeng` exportado como cópia de segurança portátil.

### Cópia opcional no Google Drive

Abre **Dados → Cópia no Google Drive** e escolhe **Ligar ao Google Drive**. A
janela da Google trata da escolha da conta; o XPENG Analytics nunca pede nem vê
a tua palavra-passe. Escolhe **Guardar no Drive** para criar o ficheiro atual
`xpeng-analytics-history.xpeng` numa pasta visível **XPENG Analytics** do teu
Drive. A página mostra a conta ligada, a última gravação bem-sucedida, o
tamanho, o período de telemetria incluído e a versão do formato portátil.

Podes ativar **Atualizar automaticamente enquanto estiver ligado**. As
importações XPENG/GPX e os My Charts guardados passam a atualizar a cópia
durante essa sessão do browser. A Google pode pedir nova autorização depois de
fechares o separador ou quando o token expirar. Desligar termina a ligação atual
mas não elimina os ficheiros do Drive. A aplicação mantém apenas a cópia
`.xpeng` processada mais recente. O painel de restauro permite confirmar data,
tamanho, cobertura e versão antes de a abrir. Recuperações criadas por versões
anteriores são enviadas para o lixo do Drive depois da próxima gravação com
sucesso.

Se um envio retomável for interrompido, a aplicação confirma a posição aceite
pela Google e continua quando isso é possível. Falta de espaço, limite
temporário, autorização expirada e ficheiro inexistente continuam a produzir
mensagens claras em vez de uma falsa confirmação de sucesso.

A página Dados também pode assinalar pausas longas entre os períodos cobertos
pelos ficheiros XPENG importados. São **possíveis falhas de importação**, não
uma prova de que faltam dados do veículo ou de que o carro esteve parado.

A própria exportação oficial também pode omitir telemetria ou dividir uma
viagem. A página Qualidade assinala casos prováveis em que o odómetro avançou
durante uma falha de registo. Isto indica cobertura entregue incompleta, não
uma avaria no veículo.

A cópia no Drive é opcional. O processamento continua a ser local, mas o
ficheiros `.xpeng` resultantes são enviados e armazenados pela Google quando
ativas esta opção. Estão comprimidos, não encriptados, e podem conter
telemetria com timestamps e coordenadas GPS. Protege-os como a exportação XPENG
original.

#### Arquivar os ZIPs XPENG originais

Depois de ligares o Drive, podes ativar separadamente **Arquivar os ZIPs
originais da XPENG**. Cada ZIP reconhecido e importado com sucesso é então
copiado sem alterações para `XPENG Analytics/Raw Files`. A
aplicação usa o SHA-256 do ZIP para ignorar um ficheiro idêntico que já esteja
arquivado.

Se importares ZIPs antes de ligares o Drive, os originais ficam em fila durante
a sessão ativa do separador. Podes depois ligar o Drive e ativar o arquivo sem
voltar a importá-los. Fechar ou atualizar o separador limpa essa fila temporária.

Isto não substitui a cópia `.xpeng`. O `.xpeng` é o histórico compacto usado
pela aplicação; um ZIP original pode conter o VIN e toda a telemetria bruta
fornecida pela XPENG. Os ZIPs originais não são encriptados e ocupam espaço no
teu Drive. A aplicação mantém o menor conjunto prático que cobre todo o período
observado, preferindo um dia de sobreposição. Um original redundante só é
enviado para o lixo do Drive depois de o substituto ser carregado, e o seu
registo permanece no `.xpeng`. Ficheiros sem cobertura fiável são sempre
mantidos.

**Arquivar também os ficheiros GPX** é uma segunda opção independente. Guarda
sem alterações os `.gpx` e ZIPs de GPX reconhecidos em
`XPENG Analytics/Original GPX files`, com a mesma verificação de duplicados pelo
hash. Os GPX originais podem conter localizações precisas fora das viagens
associadas, por isso ativar os ZIPs XPENG nunca ativa automaticamente este
arquivo de localização.

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

Sem histórico local persistente, é o comportamento esperado do modelo de
privacidade. Importa novamente os ZIPs, restaura um histórico `.xpeng` ou ativa
**Guardar este histórico neste dispositivo** na página Dados para as visitas
seguintes.

### O Google Drive pede para ligar novamente

É esperado. A aplicação estática mantém o token de acesso Google, de curta
duração, apenas na memória do separador atual. Liga novamente e depois guarda
ou abre a cópia. Se o botão estiver indisponível numa versão local, o developer
tem de configurar o Client ID OAuth público descrito em
`GOOGLE_DRIVE_SETUP.md`.

## 9. Privacidade, apoio e feedback

Nunca anexes um ZIP real da XPENG, histórico `.xpeng`, VIN, localização ou
captura não editada a uma issue pública.

- [Reportar um problema ou pedir uma funcionalidade](https://github.com/josepinto1989/xpeng-analytics/issues)
- [Ler as notas de privacidade](../PRIVACY.md)
- [Ler as recomendações de segurança](../SECURITY.md)
- [Apoiar o projeto no Ko-fi](https://ko-fi.com/mpinto)

O XPENG Analytics é um projeto comunitário independente criado e mantido por
Miguel Pinto. Não é afiliado, aprovado nem patrocinado pela XPENG.
