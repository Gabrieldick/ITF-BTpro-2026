// @ts-nocheck
// ---------- Histórias, entrevistas e personalidade (modo carreira) ----------
// Entrevistas depois dos jogos e dos torneios, coletivas antes dos grandes torneios e histórias de várias semanas (fã
// mirim, documentário, rival nas redes, reality show…). Cada resposta molda a personalidade (4 eixos de 0 a 100) e mexe
// em fama, humor do parceiro, química, dinheiro, evolução. A personalidade tem efeito no jogo (ver persEffects).
// O texto é montado de peças sorteadas (perguntas, respostas, veículos, repórteres) e evita repetir o que saiu
// recentemente. As falas podem ser lidas em voz alta pela voz do próprio navegador (speechSynthesis), se houver.
import { $s } from '../state';
import { S } from './01-estado';
import { nameOf, shortOf, clamp } from './00-base';
import { crAddFama, crMood, crChemAdd, crMaybeSponsor, crNews, crChar, crRank, crMeOvr, saveCareer, crTourT } from './14-carreira';
import { money } from './15-carreira-telas';

// ganchos chamados pela carreira (14-carreira importa este objeto; as funções são preenchidas aqui embaixo)
const HIST = {};

// ---------- personalidade ----------
// conf: humilde (0) ↔ confiante (100) · car: reservado ↔ carismático · foco: descontraído ↔ focado · temp: calmo ↔ explosivo
const AXES = [['conf', 'Humilde', 'Confiante'], ['car', 'Reservado', 'Carismático'], ['foco', 'Descontraído', 'Focado'], ['temp', 'Calmo', 'Explosivo']];
const pers = () => { const c = $s.CR; if (!c.pers) c.pers = { conf: 50, car: 50, foco: 50, temp: 50 }; return c.pers; };
function persAdd(d) { const p = pers(); for (const k in d) if (k in p) p[k] = clamp(Math.round(p[k] + d[k]), 0, 100); }
// efeitos (lidos pela carreira): fama ganha, evolução, humor do parceiro por semana, bônus de atributo
function persEffects() {
  const p = pers(), out = { fama: 1 + (p.car - 50) / 200, xp: 1 + (p.foco - 50) / 500, mood: (50 - p.conf) / 40 - Math.max(0, p.temp - 60) / 30, attr: {}, txt: [] };
  if (p.conf >= 70) { out.attr.smash = 1; out.attr.saque = 1; out.txt.push('Confiante: +1 em smash e saque'); }
  else if (p.conf <= 30) { out.txt.push('Humilde: parceiros ficam mais contentes'); }
  if (p.car >= 65) out.txt.push('Carismático: +' + Math.round((out.fama - 1) * 100) + '% de fama ganha'); else if (p.car <= 35) out.txt.push('Reservado: ' + Math.round((out.fama - 1) * 100) + '% de fama ganha');
  if (p.foco >= 65) { out.attr.leitura = 1; out.txt.push('Focado: +1 em noção de jogo e +' + Math.round((out.xp - 1) * 100) + '% de evolução'); } else if (p.foco <= 35) out.txt.push('Descontraído: ' + Math.round((out.xp - 1) * 100) + '% de evolução');
  if (p.temp >= 70) { out.attr.def = -1; out.attr.forca = 1; out.txt.push('Explosivo: +1 em força, −1 em defesa, mais provocações e parceiros mais irritados'); }
  else if (p.temp <= 30) { out.attr.def = (out.attr.def || 0) + 1; out.txt.push('Calmo: +1 em defesa'); }
  return out;
}
const persWord = () => { const p = pers(), w = []; AXES.forEach(([k, a, b]) => { if (p[k] >= 65) w.push(b.toLowerCase()); else if (p[k] <= 35) w.push(a.toLowerCase()); }); return w.length ? w.join(', ') : 'equilibrado'; };

// ---------- peças de texto ----------
const pick = a => a[Math.floor(Math.random() * a.length)];
const REC = () => ($s.CR.talkRec = $s.CR.talkRec || []);
// sorteia evitando o que saiu nas últimas ~40 falas (chave = prefixo + índice)
function pickFresh(arr, key) { const rec = REC(); let opts = arr.map((x, i) => i).filter(i => !rec.includes(key + i)); if (!opts.length) opts = arr.map((x, i) => i); const i = pick(opts); rec.push(key + i); if (rec.length > 40) rec.splice(0, rec.length - 40); return arr[i]; }
const OUTLETS = [['TV Litoral', '📺'], ['Portal Beach360', '🌐'], ['Rádio Areia FM', '📻'], ['Podcast Saque & Voleio', '🎙️'], ['Revista Pé na Areia', '📰'], ['BT Global News', '🌍'], ['Canal Smash', '📺'], ['Jornal do Circuito', '📰'], ['Beach Tennis Brasil', '📱'], ['Rede Praia Esporte', '📺'], ['Podcast Fora da Linha', '🎙️'], ['Areia Quente TV', '📺']];
const REPORTERS = [['Marina Teles', 'f'], ['Rodrigo Arantes', 'm'], ['Camila Duarte', 'f'], ['Felipe Monteiro', 'm'], ['Bia Kaneko', 'f'], ['Thiago Lacerda', 'm'], ['Luana Prado', 'f'], ['Gustavo Rezende', 'm'], ['Paula Vasconcelos', 'f'], ['Diego Sampaio', 'm'], ['Renata Okada', 'f'], ['Caio Bittencourt', 'm']];
// tom das respostas → personalidade e efeito
const TONES = {
  humilde: { d: { conf: -6, car: 1 }, fama: 1, mood: 4, chem: 1, chip: 'Humilde' },
  confiante: { d: { conf: 7, temp: 1 }, fama: 2, mood: -1, chip: 'Confiante' },
  brinca: { d: { car: 7, foco: -3 }, fama: 3, chip: 'Bem-humorado' },
  tecnico: { d: { foco: 7, car: -2 }, fama: 1, pe: 1, chip: 'Focado' },
  polemico: { d: { temp: 8, conf: 3, car: 2 }, fama: 4, mood: -4, chip: 'Polêmico', risk: true },
  parceiro: { d: { conf: -3, car: 2 }, fama: 1, mood: 7, chem: 3, chip: 'Exaltou a dupla' },
  reservado: { d: { car: -6, temp: -3 }, fama: 0, chip: 'Discreto' },
  emocao: { d: { car: 4, temp: 2 }, fama: 3, mood: 2, chip: 'Emocionado' },
};
// perguntas e respostas: cada pergunta traz as próprias respostas, uma por tom, para a resposta sempre combinar com o que foi perguntado
// ({p} parceiro, {o} adversário, {t} torneio, {r} rival, {c} cidade). Chaves curtas dos tons: h humilde, c confiante, b brinca,
// t técnico, pa exalta a dupla, po polêmico, e emoção, r reservado
const TK = { h: 'humilde', c: 'confiante', b: 'brinca', t: 'tecnico', pa: 'parceiro', po: 'polemico', e: 'emocao', r: 'reservado' };
const Q = (q, a) => ({ q, a: Object.fromEntries(Object.entries(a).map(([k, v]) => [TK[k], v])) });
const QA = {
  vitoria: [
    Q('Que vitória! O que fez a diferença contra {o}?', { h: '{o} jogou muito. A diferença foi pequena: a gente acertou um pouco mais nos pontos importantes.', c: 'A diferença foi o nível. Jogamos o nosso jogo e eles não tiveram resposta.', t: 'A devolução de saque. Começamos a ler o lado do backhand deles e a pressão mudou de lado.', pa: 'A diferença tem nome: {p}. Segurou cada bola difícil.', b: 'O açaí antes do jogo. Sério, vou repetir a receita amanhã.' }),
    Q('Vocês pareciam tranquilos o jogo todo. Foi planejado?', { h: 'Por dentro nem tanto! Mas a gente treina para não mostrar o nervoso.', c: 'Foi. Quando você sabe que é melhor, não precisa se desesperar.', t: 'Combinamos jogar ponto a ponto e não olhar o placar. Respirar entre os pontos ajuda muito.', b: 'Tranquilo por fora, liquidificador por dentro.', pa: 'Com {p} do lado fica fácil ficar calmo. A gente se acalma no olhar.' }),
    Q('O que o técnico falou entre os games?', { t: 'Pediu mais curta cruzada e menos lob, porque eles estavam recuando muito.', b: 'Falou para eu parar de reclamar do vento. Acho que funcionou.', h: 'Me lembrou de confiar no que treinamos. Ele enxerga coisas que eu não vejo dentro da quadra.', r: 'Isso fica entre a gente.', c: 'Nada de mais. Ele sabia que a gente tinha o jogo na mão.' }),
    Q('Qual foi o ponto mais bonito do jogo para você?', { b: 'Aquele que eu caí na areia e a bola voltou. Ninguém entendeu, nem eu.', t: 'A troca longa no fim do set. Ganhamos com uma curta depois de três lobs seguidos, bem construído.', pa: 'A defesa de {p} na rede, de costas. Até eu aplaudi.', c: 'O smash que fechou o jogo. Gosto de terminar assim.', e: 'O último. Quando a torcida explodiu eu senti tudo de uma vez.' }),
    Q('Como foi jogar com esse vento?', { t: 'Baixamos a altura do lob e jogamos mais a favor do vento no saque. Tem que se adaptar a cada lado.', b: 'Teve bola que eu mandei para a esquerda e foi parar no estacionamento.', h: 'Difícil para os dois lados. A gente só errou um pouco menos.', c: 'Vento não me atrapalha. Treino na praia desde criança.', po: 'Sinceramente, nem deviam ter liberado a quadra com esse vento.' }),
    Q('Você virou um jogo complicado. Como foi a cabeça na hora do aperto?', { e: 'Passou um filme. Pensei em tudo que treinei e em quem estava torcendo.', c: 'No aperto eu cresço. Sempre foi assim.', t: 'Simplifiquei: saque no corpo e bola funda. Quando aperta, menos é mais.', h: 'Fiquei nervoso, não vou mentir. Mas ponto a ponto deu para virar.', b: 'Cabeça? Eu só pensava em não errar o saque de novo.' }),
    Q('O público vibrou muito com vocês. Dá para sentir essa energia da quadra?', { e: 'Demais! Teve uma hora que me arrepiei inteiro. Obrigado, gente.', h: 'Dá sim, e ajuda muito. Agradeço cada pessoa que veio.', b: 'Senti tanto que errei um saque de emoção.', c: 'Dá. E eu jogo melhor com estádio cheio.', r: 'Sinto, mas tento me concentrar só na bola.' }),
    Q('O próximo jogo já é amanhã. Como está o corpo?', { t: 'Agora é gelo, alongamento e dormir cedo. A recuperação começa já.', b: 'O corpo pediu férias. Vou negociar até amanhã.', c: 'Inteiro. Posso jogar mais três hoje se precisar.', h: 'Um pouco cansado, mas é assim para todo mundo. Vou me cuidar.', r: 'Bem. Agora é descansar.' }),
    Q('Teve um momento em que o jogo pareceu escapar. O que mudou?', { t: 'Mudamos a posição na rede e passamos a atacar o meio. Eles não se entenderam mais.', pa: '{p} chegou em mim e falou: calma, uma bola de cada vez. Mudou tudo.', c: 'Eu decidi que não ia perder. Simples.', h: 'Eles baixaram um pouquinho e a gente aproveitou. Foi detalhe.', e: 'Olhei para a torcida e lembrei por que estou aqui.' }),
    Q('Vitória contra uma dupla de nível alto. Esse resultado muda alguma coisa?', { h: 'Dá confiança, mas é só um jogo. Amanhã começa tudo de novo.', c: 'Muda o que os outros pensam. Eu já sabia que podia.', t: 'Mostra que o plano de jogo funciona contra duplas fortes. Vamos manter.', po: 'Muda para quem duvidava. Para mim, era o resultado esperado.', b: 'Muda o meu pedido de pizza hoje: vai ser a grande.' }),
    Q('Muita gente comentou o seu smash hoje. Foi o melhor golpe da partida?', { c: 'Foi. Quando entra daquele jeito, não tem defesa.', t: 'O smash entrou porque a preparação foi boa: o lob deles saiu curto e eu cheguei cedo na bola.', h: 'Entrou bem hoje, mas a defesa foi o que segurou a gente.', b: 'Vou dizer que foi treinado. Não foi.', pa: 'O smash só sai porque {p} prepara a bola. Metade é dele.' }),
  ],
  zebra: [
    Q('Ninguém apostava em vocês contra {o}. Qual o segredo da zebra?', { h: 'Não tem segredo: a gente acreditou e eles deram uma chance. Respeito total a {o}.', c: 'Zebra para quem não me conhece. Eu sabia que dava.', t: 'Estudamos o jogo deles. Eles sofrem com bola no meio e jogamos tudo ali.', b: 'O segredo é não ler as apostas antes do jogo.', e: 'Não tenho palavras. Foi a vitória mais especial da minha vida até aqui.' }),
    Q('Vitória sobre favoritos! Vocês acreditaram desde o início?', { e: 'Desde o aquecimento. Algo me dizia que hoje era o dia.', h: 'Acreditar a gente acredita sempre. Mas confesso que no começo foi difícil.', c: 'Claro. Ninguém entra em quadra para perder.', b: 'Eu acreditei no segundo set. No primeiro eu estava só sobrevivendo.', pa: '{p} acreditou primeiro e me puxou junto.' }),
    Q('Os rankings diziam o contrário. Hoje vocês provaram o quê?', { po: 'Que ranking não ganha jogo. Muita gente está lá em cima por calendário, não por nível.', c: 'Que meu lugar é lá em cima. É questão de tempo.', h: 'Que todo mundo pode ganhar de todo mundo. Amanhã pode ser a gente do outro lado.', t: 'Que um bom plano de jogo vale tanto quanto pontos no ranking.', b: 'Que matemática não é o meu forte, mas beach tennis é.' }),
  ],
  derrota: [
    Q('O que faltou hoje contra {o}?', { h: '{o} foi melhor. Faltou eu jogar no meu nível, e eles não deixaram.', t: 'Faltou variação. Jogamos muito lob e eles estavam esperando.', c: 'Faltou só o dia ser nosso. Nível eu tenho.', po: 'Faltou uma arbitragem melhor, para começar.', r: 'Prefiro analisar com calma antes de falar.' }),
    Q('Teve uma chance clara no fim. O que aconteceu ali?', { t: 'Escolhi o smash quando era bola de curta. Decisão errada na hora errada.', h: 'Errei. Simples assim. Vou rever esse ponto mil vezes.', b: 'Aconteceu que a bola resolveu ir passear fora da quadra.', c: 'Faz parte. Na próxima aquela bola entra.', r: 'Não quero falar desse ponto agora.' }),
    Q('Vocês vão continuar juntos depois desse resultado?', { pa: 'Claro. Uma derrota não apaga o que a gente construiu. {p} sabe disso.', h: 'Vamos conversar com calma, mas a ideia é seguir.', r: 'Isso a gente conversa entre nós, não aqui.', po: 'Vou pensar bem. Algumas coisas precisam mudar.', b: 'Depende de quem paga o jantar hoje.' }),
    Q('O calor pesou hoje?', { t: 'Pesou no fim do segundo set. A hidratação entre os games não foi suficiente.', h: 'Pesou para os dois lados. Não é desculpa.', po: 'Pesou porque marcaram o jogo no pior horário. Alguém tem que pensar no atleta.', b: 'Eu derreti. Literalmente. Ainda estou procurando meu boné.', c: 'Calor não decide jogo. Decidiram eles, hoje.' }),
    Q('Uma derrota dura. Como você sai dessa partida?', { h: 'Triste, mas com vontade de treinar mais. Eles mereceram.', e: 'Dói muito. Eu queria muito esse jogo, pela torcida também.', c: 'Saio com raiva, e raiva boa. Volto mais forte.', r: 'Vou para casa descansar. Amanhã eu penso nisso.', b: 'Saio pela porta da frente, com o bronzeado em dia.' }),
    Q('Vocês pareciam abaixo do normal. Foi físico ou mental?', { t: 'Mais físico. As pernas não chegaram nas bolas curtas no fim.', h: 'Um pouco dos dois. Não estava no meu melhor e vou ser honesto sobre isso.', po: 'Foi o calendário. A gente chega destruído em todo torneio.', r: 'Foi um dia ruim. Só isso.', c: 'Nenhum dos dois. Eles jogaram bem e acabou.' }),
    Q('O que fica de lição desse torneio?', { t: 'Preciso melhorar a transição para a rede e a primeira bola depois do saque.', h: 'Que ainda tenho muito a aprender. E vou aprender.', c: 'Que eu estou perto. Muito perto.', e: 'Que eu amo isso aqui, mesmo quando perco.', b: 'Que eu preciso de um protetor solar melhor.' }),
    Q('A torcida esperava mais. O que você diria para quem veio te ver?', { h: 'Desculpa e obrigado. Vou trabalhar para dar mais alegria na próxima.', e: 'Obrigado de verdade. Ouvir vocês me deu força até o último ponto.', c: 'Que voltem no próximo torneio. A história vai ser outra.', b: 'Que pelo menos o show de quedas na areia foi bom.', r: 'Obrigado pelo carinho.' }),
  ],
  titulo: [
    Q('Campeões do {t}! O que passa pela cabeça agora?', { e: 'Passa a minha vida inteira. Todo treino, toda viagem… valeu a pena.', h: 'Ainda não caiu a ficha. Só agradeço a cada pessoa que torceu.', c: 'Que é só o começo. Quero muitos outros.', b: 'Que eu preciso descobrir como levar esse troféu no avião.', pa: 'Que {p} é o melhor parceiro que eu podia ter.' }),
    Q('Em algum momento você achou que não ia dar?', { h: 'Achei, na semifinal. Foi muito difícil e eles quase viraram.', c: 'Não. Nem quando estava perdendo.', e: 'No ano passado pensei em desistir de tudo. Hoje eu tô aqui.', b: 'Quando eu vi o tamanho do adversário no sorteio, deu um frio na barriga.', t: 'No começo da final. Depois que ajustamos a devolução de saque, ficou sob controle.' }),
    Q('O que esse título muda no ranking?', { t: 'São pontos importantes, mas o que eu quero é manter a regularidade em todo torneio.', c: 'Muda tudo. Quero subir mais e não vou parar.', h: 'Ajuda, claro. Mas ranking é consequência do trabalho.', b: 'Vou finalmente conseguir ver meu nome sem rolar a página.', r: 'Não olho muito o ranking. Vou ver depois.' }),
    Q('Quem foi a primeira pessoa para quem você ligou?', { e: 'Para a minha mãe. Ela chorou, eu chorei… foi lindo.', h: 'Para a minha família. Eles acordaram cedo comigo a vida inteira.', b: 'Ainda não liguei para ninguém. Estou procurando o celular desde o pódio.', pa: 'Nem precisei ligar: o primeiro abraço foi de {p}.', r: 'Isso eu guardo para mim.' }),
    Q('Qual foi o ponto mais difícil da semana?', { t: 'O match point da semifinal. Salvamos com uma curta cruzada que a gente treinou a semana toda.', h: 'A estreia. Primeiro jogo sempre dá nervoso.', b: 'O mais difícil foi acordar às seis para a estreia.', e: 'A semi. Quando ganhamos aquele ponto eu sabia que o título era possível.', c: 'Difícil, difícil mesmo, nenhum. Estava tudo sob controle.' }),
    Q('Esse é o título mais importante da sua carreira?', { e: 'Sem dúvida. Vou lembrar desse dia para sempre.', c: 'Por enquanto. Os mais importantes ainda vão vir.', h: 'É especial, mas cada título tem a sua história.', b: 'É o mais pesado, pelo menos. Esse troféu pesa uma tonelada.', t: 'Pelo nível da chave, sim. Ganhamos de duplas muito fortes.' }),
    Q('Para quem você dedica esse troféu?', { e: 'À minha família. Sem eles eu não teria nem raquete.', h: 'A todo mundo que me ajudou desde as quadras do clube.', pa: 'Metade é de {p}. A outra metade também, na verdade.', po: 'A quem duvidou de mim. Esse aqui é para vocês.', b: 'Ao meu travesseiro, que vai dividir a cama com o troféu hoje.' }),
    Q('Como vai ser a comemoração hoje?', { b: 'Pizza tamanho família e zero culpa. Amanhã eu volto para a dieta.', h: 'Um jantar tranquilo com quem me ajudou. Nada de mais.', e: 'Abraçando todo mundo que veio até aqui torcer.', r: 'Em casa, descansando. Gosto de silêncio.', c: 'Hoje eu comemoro. Amanhã já começo a pensar no próximo título.' }),
  ],
  vice: [
    Q('Faltou pouco para o título. O que pesou na final?', { t: 'Eles foram mais agressivos na volta do saque e a gente demorou a ajustar.', h: 'Pesou o nível deles. Parabéns aos campeões, mereceram.', c: 'Pesou um ou dois pontos. Na próxima final é minha.', po: 'Pesou umas decisões estranhas da arbitragem, para ser sincero.', e: 'Pesou o coração. Eu queria demais e talvez isso tenha atrapalhado.' }),
    Q('Uma semana de grande nível, mas sem o troféu. Fica o gosto amargo?', { e: 'Fica, dói perder uma final. Mas olha esse público… obrigado.', h: 'Um pouco, mas chegar na final já é enorme. Estamos no caminho.', c: 'Fica, e é bom que fique. Vou usar isso para ganhar a próxima.', b: 'Amargo nada: prata combina com a minha raquete.', r: 'Prefiro não pensar nisso hoje.' }),
    Q('O que você leva de positivo dessa final?', { t: 'O jogo de rede evoluiu muito. Ganhamos a maioria das trocas curtas da semana.', h: 'Ganhei confiança. Mostrei para mim mesmo que posso jogar finais.', pa: 'A dupla. {p} jogou uma semana gigante.', c: 'Que estou pronto para ganhar torneios grandes.', b: 'Um cheque menor que o do campeão, mas ainda é um cheque.' }),
  ],
  pre: [
    Q('O {t} começa amanhã. Qual a expectativa?', { h: 'Vou jogo a jogo. A chave é forte e todo mundo pode ganhar.', c: 'Vim para ganhar. Não tem outro objetivo.', t: 'Quero manter o nível de saque e devolução da semana passada. O resto vem.', b: 'Minha meta principal é não errar o caminho do hotel. O resto é lucro.', pa: 'Com {p} do lado, a expectativa é ir longe.' }),
    Q('Tem algum adversário que você prefere evitar na chave?', { c: 'Não. Prefiro que os outros evitem a gente.', h: 'Todo mundo é difícil. Não dá para escolher.', b: 'Prefiro evitar quem joga de óculos espelhado. Me distrai.', t: 'Duplas que jogam muito na rede dão mais trabalho para o nosso estilo. Mas estamos preparados.', po: 'Tem uns aí que só estão na chave pelo sorteio. Esses eu quero encontrar.' }),
    Q('Você já jogou bem aqui antes. Isso ajuda?', { h: 'Ajuda a ficar à vontade, mas cada ano é diferente.', t: 'Ajuda: já conheço o vento e a areia de {c}, que é mais fofa que a média.', c: 'Ajuda. Esta quadra gosta de mim.', b: 'Ajuda, porque eu já sei onde fica o melhor açaí da cidade.', e: 'Muito. Tenho lembranças lindas daqui.' }),
    Q('Como está o corpo depois de tantas viagens?', { t: 'Bem cuidado. Fisioterapia todo dia e sono regrado, mesmo no avião.', po: 'Cansado, como o de todo mundo. O calendário é um absurdo.', h: 'Um pouco cansado, mas faz parte da vida de atleta.', b: 'O corpo está aqui. A mala ainda está em outro aeroporto.', c: 'Perfeito. Nunca estive tão bem.' }),
    Q('A chave do {t} está pesada. Quem você vê como favorito?', { c: 'Eu. E digo isso com todo o respeito pelos outros.', h: 'Os cabeças de chave, claro. A gente corre por fora.', po: 'Favorito no papel é uma coisa. Na areia a conversa é outra.', b: 'O favorito é quem trouxe mais protetor solar.', r: 'Não gosto de fazer previsão.' }),
    Q('Você chega em boa fase. Dá para pensar em título?', { c: 'Dá, e eu penso. Vim para isso.', h: 'Penso no primeiro jogo. Se chegar lá, aí a gente conversa.', t: 'A fase é boa porque o saque está entrando. Se mantiver isso, temos chance.', e: 'Seria um sonho. Estou trabalhando muito por isso.', pa: 'Com {p} nessa fase, dá para sonhar sim.' }),
    Q('Como foi a preparação para o {t}?', { t: 'Muito treino de devolução e transição para a rede, e físico para aguentar o calor.', b: 'Teve treino, teve dieta e teve uma pizza escondida.', h: 'Dentro do possível, tranquila. Treinei o que o técnico pediu.', r: 'Normal. Treino e descanso.', c: 'A melhor da minha carreira. Estou pronto.' }),
  ],
  vida: [
    Q('Como é a sua rotina fora da quadra?', { t: 'Durmo cedo, cuido da alimentação e assisto aos meus jogos. Detalhe vira resultado.', b: 'Fora da quadra eu sou um desastre na cozinha. Só sei fazer miojo e smash.', r: 'Bem tranquila. Gosto de ficar em casa.', h: 'Normal, como a de qualquer pessoa: família, amigos e muito treino.', c: 'Tudo gira em torno de ser o melhor. Não tenho folga.' }),
    Q('Qual atleta você admirava quando criança?', { h: 'Os pioneiros do beach tennis no Brasil. Sem eles nada disso existiria.', e: 'Meu pai jogava no fim de semana. Ele foi meu primeiro ídolo.', b: 'O goleiro do time do meu bairro. Pulava mais que eu no smash.', c: 'Admirava muitos. Hoje quero ser o atleta que as crianças admiram.', r: 'Prefiro não citar nomes.' }),
    Q('O que ninguém sabe sobre você?', { b: 'Tenho medo de caranguejo. Jogo na praia e tenho medo de caranguejo.', r: 'Se ninguém sabe, é porque eu prefiro assim.', h: 'Que eu fico muito nervoso antes de todo jogo, até hoje.', e: 'Que eu choro vendo filme de esporte. Todos.', c: 'Que eu treino mais do que qualquer um no circuito.' }),
    Q('Como você lida com as viagens e a saudade de casa?', { e: 'É a parte mais difícil. Ligo para a família todo dia.', h: 'Com paciência. Sei que é o preço de viver do esporte.', b: 'Levo o travesseiro de casa para todo lado. Ele já tem mais milhas que eu.', t: 'Tento manter a mesma rotina em qualquer cidade: horário de sono, alimentação e treino.', r: 'Lido bem. Sou bem independente.' }),
    Q('Qual foi o momento mais difícil da sua carreira?', { e: 'Quando quase parei por falta de dinheiro. Muita gente me ajudou a continuar.', h: 'Uma sequência de derrotas no começo. Aprendi muito com ela.', c: 'Difícil foi só no começo. Agora é só subir.', r: 'Prefiro deixar isso no passado.', t: 'Uma lesão no ombro. Tive que mudar o movimento do saque inteiro.' }),
    Q('O que te motiva a acordar cedo para treinar?', { c: 'Ser o número um. Simples assim.', e: 'A minha família e esse esporte que mudou a minha vida.', b: 'O café. Sem café não tem treino.', h: 'Saber que tem muita gente que queria estar no meu lugar.', t: 'Ver a evolução nos números: cada décimo de segundo no deslocamento conta.' }),
    Q('Qual o seu sonho no beach tennis?', { c: 'Ser número um do mundo. Não tenho vergonha de dizer.', e: 'Ganhar um Mundial com a minha família na arquibancada.', h: 'Viver do esporte e inspirar a garotada que está começando.', b: 'Ter um smash com o meu nome. Tipo "o fulano". Ainda não pensei no nome.', pa: 'Ganhar tudo ao lado de {p}.' }),
    Q('Muita gente te segue nas redes agora. Como lida com a fama?', { h: 'Fico sem graça com elogio, mas agradeço muito o carinho.', r: 'Uso pouco as redes. Prefiro manter a vida pessoal longe das câmeras.', b: 'Minha mãe ainda curte todas as fotos. Ela é a fã número um.', c: 'Gosto. Mostra que o trabalho está aparecendo.', po: 'Tem muita gente que só critica. Esses eu bloqueio sem dó.' }),
    Q('Se não fosse atleta, o que você seria?', { b: 'Vendedor de picolé na praia. Ia estar na areia do mesmo jeito.', h: 'Professor de beach tennis, provavelmente. Gosto de ensinar.', t: 'Algo com números. Gosto de analisar dados dos meus jogos.', e: 'Não consigo imaginar. Esse esporte é a minha vida.', c: 'Seria o melhor no que eu escolhesse.' }),
  ],
  rival: [
    Q('{r} disse que você não aguenta pressão. Quer responder?', { po: '{r} fala muito. Na quadra o placar fala por mim.', c: 'Respondo na areia. Me encontra na chave.', h: 'Respeito a opinião. Vou continuar trabalhando.', b: 'Deve ter confundido pressão com pressão alta. Estou ótimo, obrigado.', r: 'Não vou comentar.' }),
    Q('Vocês e {r} viraram rivais. Existe amizade fora da quadra?', { h: 'Existe respeito. Rivalidade é dentro da quadra.', po: 'Amizade? Não. E está tudo bem assim.', b: 'A gente se cumprimenta. De longe. Bem de longe.', r: 'Cada um na sua.', c: 'Fora da quadra tudo bem. Dentro, não espere presente.' }),
    Q('O próximo encontro com {r} pode decidir o ranking. Tem algum recado?', { c: 'Pode vir. Estou pronto.', po: 'Recado: vai ser diferente da última vez.', t: 'Já estou estudando os jogos de {r}. Tem coisa para explorar.', h: 'Que seja um grande jogo para o público.', b: 'Meu recado é: traz protetor, vai ser um jogo longo.' }),
  ],
  parceiro: [
    Q('Como está a relação com {p}? Há boatos de separação.', { pa: 'Melhor do que nunca. {p} é a pessoa certa do meu lado.', po: 'Boato é boato. Quem espalha devia cuidar da própria dupla.', r: 'Isso a gente resolve entre nós.', b: 'Separação? A gente nem casou ainda.', h: 'Está tudo bem. Como toda dupla, temos dias bons e ruins.' }),
    Q('{p} vive grande fase. Isso pressiona você?', { pa: 'Me inspira. Quando {p} joga assim, eu quero acompanhar.', c: 'Pressão nenhuma. Eu também estou em grande fase.', h: 'Um pouco. Mas pressão boa: quero estar à altura.', b: 'Pressiona, porque agora os aplausos são todos para o outro lado da quadra.', t: 'Faz eu cuidar mais da minha parte: saque e defesa do meu lado.' }),
    Q('O que {p} tem que nenhum outro parceiro teve?', { pa: 'Leitura de jogo. {p} sabe para onde eu vou antes de eu ir.', b: 'Paciência para aguentar as minhas piadas.', t: 'Uma defesa de fundo absurda, que me deixa livre para atacar na rede.', h: 'Humildade. Nunca vi {p} reclamar de uma bola minha.', e: 'Coração. Joga cada ponto como se fosse o último.' }),
  ],
};

const Q_OPEN = { vitoria: ['', '', 'Parabéns! ', 'Com essa torcida toda… ', 'Ainda sem fôlego, né? '], zebra: ['', 'Que zebra! ', 'Que resultado! '], derrota: ['', '', 'Sei que é um momento difícil, mas… ', 'Rapidinho: '],
  titulo: ['', 'Campeão! ', 'Que semana! ', 'Com o troféu na mão: '], vice: ['', 'Parabéns pela campanha. ', 'Semana enorme. '], pre: ['', 'Bem-vindo! ', 'Último treino antes da estreia. ', 'Você parece tranquilo. '],
  vida: ['', 'Num papo mais leve: ', 'Fora das quadras: ', 'Pergunta dos seguidores: '], rival: ['', 'Não dá para não perguntar: ', 'O assunto da semana: '], parceiro: ['', 'Sobre a dupla: ', 'Muita gente quer saber: '] };
const A_OPEN = { humilde: ['', '', 'Olha, ', 'Sinceramente, '], confiante: ['', '', 'Vou ser direto: ', 'Sem falsa modéstia: ', 'Escuta: '], brinca: ['', '', '(rindo) ', 'Olha só… '],
  tecnico: ['', '', 'Olhando o jogo, ', 'Analisando com calma, '], polemico: ['', 'Vou falar o que penso: ', 'Ninguém fala, então eu falo: ', 'Desculpa, mas '], parceiro: ['', 'Antes de tudo: ', 'Isso aqui é dupla, então: '],
  reservado: ['', '', 'Hum… '], emocao: ['', '(respira fundo) ', '(emocionado) '] };
function fill(s, D) { return s.replace(/\{(\w)\}/g, (m, k) => D[k] || '').replace(/\s+/g, ' ').trim(); }
// monta uma entrevista: veículo, repórter, pergunta e 3 respostas de tons diferentes
// junta a abertura com a frase: depois de "," ":" ou "mas", a frase continua em minúscula (menos quando começa com um nome)
function join(pre, txt, D) { const base = fill(txt, D); pre = pre.replace(/\{(\w)\}/g, (m, k) => D[k] || ''); return pre + (pre && /([,:]|\bmas)\s*$/.test(pre) && !/^\{/.test(txt) && !/^[A-Z]{2}/.test(base) ? base.charAt(0).toLowerCase() + base.slice(1) : base); }
function makeInterview(kind, D, extra) {
  // sem parceiro (simples) ou sem rival: só perguntas que não dependem deles
  const ok = x => (D.p || !/\{p\}|\bvocês\b|juntos/i.test(x.q)) && (D.r || !/\{r\}/.test(x.q)), pool = (QA[kind] || QA.vitoria).filter(ok);
  const it = pickFresh(pool.length ? pool : QA.vida, 'q' + kind);
  let tones = Object.keys(it.a).filter(t => (D.p || !/\{p\}/.test(it.a[t])) && (t !== 'parceiro' || D.p) && (t !== 'polemico' || Math.random() < .85));
  tones.sort(() => Math.random() - .5); tones = tones.slice(0, 3);
  const [out, ico] = pickFresh(OUTLETS, 'o'), [rep, rg] = pickFresh(REPORTERS, 'r');
  // vq / v: os textos-modelo (sem os nomes) para achar as falas gravadas
  const qo = /!/.test(it.q) ? '' : pick(Q_OPEN[kind] || ['']); // pergunta que já abre com exclamação dispensa a abertura
  return Object.assign({ type: 'entrevista', kind, outlet: out, ico, rep, rg, q: join(qo, it.q, D), vq: [qo, it.q],
    opts: tones.map(t => { const pre = pick(A_OPEN[t] || ['']); return { tone: t, txt: join(pre, it.a[t], D), v: [pre, it.a[t]] }; }) }, extra || {});
}

// ---------- histórias de várias etapas ----------
// cada etapa: texto, opções [rótulo, efeito, próxima etapa (ou null) e em quantas semanas]
const STORIES = {
  fa: { title: 'O fã mirim', ok: () => ($s.CR.fama || 0) >= 8, steps: {
    a: { t: () => pick(['Uma carta chegou à sua casa: {k}, de 9 anos, diz que treina todo dia imitando o seu saque e sonha em te conhecer.', 'Um vídeo viralizou: {k}, de 8 anos, chorando de emoção ao ver você jogar. A mãe pede um recado.']),
      o: [['Convidar {k} para ver um treino', { car: 6, conf: -3, fama: 3, energy: -4 }, 'b', 2], ['Mandar uma raquete autografada', { car: 3, fama: 2, money: -300 }, 'c', 3], ['Responder com um áudio rápido', { car: 1 }, null]] },
    b: { t: () => '{k} apareceu no treino com a camisa da sua dupla. Os pais gravaram tudo e o vídeo explodiu nas redes.', o: [['Bater bola com {k} e postar junto', { car: 5, fama: 6 }, null], ['Agradecer e voltar ao treino', { foco: 4, fama: 2 }, null]] },
    c: { t: () => '{k} ganhou o primeiro torneio infantil usando a sua raquete e dedicou o título a você.', o: [['Fazer uma homenagem nas redes', { car: 4, fama: 4 }, null], ['Ligar para parabenizar em particular', { conf: -3, car: 1 }, null]] },
  } },
  doc: { title: 'O documentário', ok: () => ($s.CR.fama || 0) >= 25, steps: {
    a: { t: () => 'Uma produtora quer filmar sua rotina por um mês para uma série sobre o circuito.', o: [['Topar: câmeras liberadas', { car: 6, foco: -4, fama: 4, money: 2000 }, 'b', 3], ['Só nos torneios, treino fechado', { foco: 3, fama: 2, money: 800 }, 'b', 3], ['Recusar: preciso de foco', { foco: 6, car: -4 }, null]] },
    b: { t: () => 'O primeiro episódio estreou. A cena mais comentada é você ' + pick(['discutindo com o técnico depois de uma derrota', 'cantando no carro antes da final', 'cuidando de um machucado de madrugada', 'fazendo churrasco para a equipe']) + '.', o: [['Comentar com bom humor', { car: 4, fama: 5 }, null], ['Pedir para cortarem a cena', { conf: -2, temp: 2, fama: -1 }, null], ['Assumir e defender a cena', { conf: 4, temp: 3, fama: 4 }, null]] },
  } },
  redes: { title: 'Provocação nas redes', ok: () => ($s.CR.fama || 0) >= 12, steps: {
    a: { t: () => '{r} postou um vídeo imitando o seu jeito de comemorar, com a legenda: "treinando para quando eu ganhar dele".', o: [['Responder com outro vídeo, zoando de volta', { car: 4, temp: 4, fama: 5, feud: true }, 'b', 2], ['Ignorar e treinar', { foco: 5, temp: -4 }, null], ['Responder duro', { temp: 8, conf: 4, fama: 4, feud: true }, 'b', 2]] },
    b: { t: () => 'A briga virou assunto: o próximo encontro com {r} já é chamado de "o clássico das redes".', o: [['Topar e prometer vitória', { conf: 5, fama: 3 }, null], ['Pedir trégua publicamente', { conf: -4, temp: -5, car: 3 }, null]] },
  } },
  clube: { title: 'Volta às origens', ok: () => true, steps: {
    a: { t: () => 'O clube onde você começou quer dar o seu nome à quadra central e fazer uma festa no fim de semana.', o: [['Ir à festa e dar uma clínica', { conf: -5, car: 4, fama: 3, energy: -8 }, null], ['Mandar um vídeo de agradecimento', { car: 1, fama: 1 }, null], ['Pedir para doarem a homenagem a um projeto social', { conf: -6, car: 3, fama: 4 }, null]] },
  } },
  reality: { title: 'Convite para reality', ok: () => ($s.CR.fama || 0) >= 35, steps: {
    a: { t: () => 'Um reality show de esportes quer você numa prova de fim de semana. Cachê alto, muita exposição.', o: [['Aceitar', { car: 7, foco: -6, fama: 7, money: 6000, energy: -12 }, 'b', 2], ['Recusar com educação', { foco: 4 }, null]] },
    b: { t: () => 'Você ' + pick(['venceu a prova de equilíbrio na água', 'caiu na piscina na primeira prova', 'virou meme dançando forró no episódio', 'chorou falando da família no confessionário']) + '. O episódio teve audiência recorde.', o: [['Curtir a repercussão', { car: 4, fama: 4 }, null], ['Voltar o foco para o circuito', { foco: 5, car: -2 }, null]] },
  } },
  social: { title: 'Projeto social', ok: () => ($s.CR.money || 0) >= 3000, steps: {
    a: { t: () => 'Uma ONG pede apoio para levar beach tennis a crianças de uma comunidade em {c}.', o: [['Doar e ir pessoalmente', { conf: -4, car: 5, fama: 5, money: -2500, energy: -5 }, 'b', 4], ['Doar sem aparecer', { conf: -5, car: -1, fama: 1, money: -2500 }, null], ['Agora não dá', { car: -2 }, null]] },
    b: { t: () => 'O projeto cresceu: são 60 crianças treinando, e duas foram convocadas para a seleção infantil.', o: [['Visitar e dar aula', { car: 4, fama: 4, energy: -4 }, null], ['Mandar material novo', { fama: 2, money: -800 }, null]] },
  } },
  critico: { title: 'A crítica', ok: () => true, steps: {
    a: { t: () => 'Um colunista escreveu que você "joga bonito, mas some nos pontos importantes".', o: [['Rebater publicamente', { temp: 7, conf: 4, fama: 3 }, 'b', 2], ['Chamar o colunista para ver um treino', { car: 5, conf: -2, fama: 2 }, 'b', 2], ['Ignorar', { foco: 4, temp: -4 }, null]] },
    b: { t: () => 'O colunista voltou ao assunto. Desta vez o texto diz: "' + pick(['reconheço: errei sobre a pressão', 'continua sumindo nos pontos importantes', 'tem personalidade, falta regularidade']) + '".', o: [['Deixar passar', { temp: -3, foco: 2 }, null], ['Responder com ironia', { car: 3, temp: 3, fama: 2 }, null]] },
  } },
  boato: { title: 'Boato de separação', ok: () => !!$s.CR.partner, steps: {
    a: { t: () => 'Um perfil de fofoca diz que você vai trocar {p} por outra dupla no fim da temporada.', o: [['Desmentir junto com {p}', { car: 3, mood: 10, chem: 4, fama: 2 }, null], ['Não comentar', { car: -3, mood: -6 }, null], ['Dizer que "tudo pode acontecer"', { conf: 4, temp: 3, mood: -12, fama: 3 }, null]] },
  } },
  lenda: { title: 'Elogio de uma lenda', ok: () => crMeOvr() >= 75, steps: {
    a: { t: () => 'Uma lenda do beach tennis disse num podcast que você é "o futuro do esporte".', o: [['Agradecer com humildade', { conf: -5, car: 3, fama: 3 }, null], ['Dizer que o futuro já chegou', { conf: 7, fama: 4 }, null], ['Convidar para um treino juntos', { car: 4, foco: 3, fama: 2, pe: 2 }, null]] },
  } },
  festa: { title: 'Aniversário', ok: () => true, steps: {
    a: { t: () => 'É o seu aniversário e os amigos prepararam uma festa na praia. Tem torneio no fim de semana.', o: [['Ir à festa e voltar cedo', { car: 3, energy: -4 }, null], ['Festa até tarde', { car: 5, foco: -6, energy: -14, fama: 2 }, null], ['Ficar em casa descansando', { foco: 5, car: -3, energy: 6 }, null]] },
  } },
  marca: { title: 'Comercial polêmico', ok: () => ($s.CR.fama || 0) >= 20, steps: {
    a: { t: () => 'Uma marca de energético quer você num comercial provocando outros atletas. Paga bem.', o: [['Topar', { temp: 6, conf: 5, fama: 5, money: 4000, feud: true }, null], ['Topar, mas sem provocação', { car: 2, money: 2000, fama: 2 }, null], ['Recusar', { conf: -2, temp: -3 }, null]] },
  } },
  lesaoAmigo: { title: 'Um amigo lesionado', ok: () => true, steps: {
    a: { t: () => '{r}, seu adversário frequente, rompeu o tendão e vai ficar meses fora.', o: [['Mandar mensagem de apoio pública', { car: 4, temp: -4, fama: 3 }, null], ['Visitar no hospital', { car: 2, conf: -4, temp: -3, energy: -3 }, null], ['Seguir focado no seu jogo', { foco: 3, car: -2 }, null]] },
  } },
  dancinha: { title: 'Desafio viral', ok: () => true, steps: {
    a: { t: () => 'Uma dancinha com raquete está bombando e o circuito todo está gravando. Pedem a sua.', o: [['Gravar com {p}', { car: 5, foco: -2, fama: 4, mood: 4 }, null], ['Gravar sozinho', { car: 4, foco: -2, fama: 3 }, null], ['Passar a vez', { car: -3, foco: 2 }, null]] },
  } },
};

// ---------- fila e efeitos ----------
function ctx() {
  const C = $s.CR, p = C.partner ? shortOf(crChar(C.partner)) : '', r = C.feud ? C.feud.name : (() => { const ids = Object.keys(C.rivals || {}); return ids.length ? shortOf(crChar(ids[0]) || { name: 'Silva' }) : pick(['Kozlov', 'Gianotty', 'Baram', 'Molla', 'Ramoz']); })();
  return { p, r, k: pick(['Lara', 'Pedrinho', 'Malu', 'Davi', 'Helena', 'Theo', 'Sofia', 'Bento', 'Alice', 'Joaquim']), c: (C.tour && C.tour.name || pick(['Florianópolis', 'Rio de Janeiro', 'Fortaleza', 'Vitória', 'Maceió'])).replace(/^.*? · /, '').replace(/ · .*$/, '').replace(/^BT\d+ /, '') };
}
function queue(item) { const C = $s.CR; if (!C) return; C.talks = C.talks || []; if (C.talks.length < 3) C.talks.push(item); }
// efeitos de uma escolha → lista de "chips" para mostrar
function applyEff(e) {
  const C = $s.CR, chips = [], d = {};
  ['conf', 'car', 'foco', 'temp'].forEach(k => { if (e[k]) d[k] = e[k]; });
  persAdd(d);
  if (e.fama) { crAddFama(e.fama); chips.push((e.fama > 0 ? '+' : '') + e.fama + ' fama'); }
  if (e.mood && C.partner) { crMood(e.mood); chips.push('humor de ' + shortOf(crChar(C.partner)) + ' ' + (e.mood > 0 ? '+' : '') + e.mood); }
  if (e.chem && C.partner) { crChemAdd(e.chem); chips.push('+' + e.chem + ' química'); }
  if (e.money) { C.money = Math.max(0, (C.money || 0) + e.money); chips.push((e.money > 0 ? '+' : '−') + money(Math.abs(e.money))); }
  if (e.energy) { C.energy = clamp((C.energy || 0) + e.energy, 0, 100); chips.push((e.energy > 0 ? '+' : '') + e.energy + ' energia'); }
  if (e.pe) { C.pe = (C.pe || 0) + e.pe; chips.push('+' + e.pe + ' evolução'); }
  if (e.feud && !C.feud) { const D = ctx(); C.feud = { name: D.r, id: null, weeks: 4 }; chips.push('rivalidade acesa com ' + D.r); }
  if (e.sponsor) crMaybeSponsor(true);
  AXES.forEach(([k, a, b]) => { if (d[k]) chips.push((d[k] > 0 ? b : a).toLowerCase() + ' ' + (d[k] > 0 ? '↑' : '↓')); });
  return chips;
}
function answerTalk(i) {
  const C = $s.CR, T = C.talks && C.talks[0]; if (!T || T.done) return null;
  let chips = [], reply = '';
  if (T.type === 'entrevista') {
    const o = T.opts[i], tn = TONES[o.tone]; reply = o.txt; T.vr = o.v;
    const e = Object.assign({}, tn.d, { fama: tn.fama * (T.big ? 2 : 1), mood: tn.mood, chem: tn.chem, pe: tn.pe });
    if (tn.risk && Math.random() < .35) { e.fama = -2; e.sponsorRisk = true; }
    chips = applyEff(e); chips.unshift(tn.chip);
    if (e.sponsorRisk) chips.push('a fala repercutiu mal com um patrocinador');
    if (tn.risk && Math.random() < .3 && !C.feud) chips = chips.concat(applyEff({ feud: true }));
    if (T.big && (o.tone === 'brinca' || o.tone === 'emocao') && Math.random() < .3) { crMaybeSponsor(true); chips.push('uma marca curtiu e quer conversar'); }
    if (T.big && Math.random() < .4) crNews('"' + reply.slice(0, 90) + (reply.length > 90 ? '…' : '') + '" — ' + shortOf(C.me) + ' ao ' + T.outlet, T.ico);
  } else {
    const st = STORIES[T.sid], step = st.steps[T.step], o = step.o[i];
    reply = fill(o[0], T.D); chips = applyEff(o[1]);
    if (o[2]) (C.storyQ = C.storyQ || []).push({ sid: T.sid, step: o[2], at: absW() + (o[3] || 2), D: T.D });
  }
  T.done = true; T.reply = reply; T.chips = chips; saveCareer();
  return T;
}
function closeTalk() { const C = $s.CR; if (C && C.talks) { C.talks.shift(); saveCareer(); } }
const absW = () => ($s.CR.season - 1) * 52 + $s.CR.week;

// ---------- ganchos da carreira ----------
// depois de cada jogo seu num torneio (vitória marcante ou derrota): entrevista rápida às vezes
HIST.afterMatch = (won, opp, tour) => {
  if (!$s.CR || !tour || tour.done) return;
  const D = ctx(); D.o = opp ? opp : 'o adversário';
  const upset = won && tour.teams && tour.teams[tour.me] && opp && tour.zebra;
  if (Math.random() < (upset ? .8 : won ? .22 : .15)) queue(makeInterview(upset ? 'zebra' : won ? 'vitoria' : 'derrota', D, { big: false }));
};
// fim do torneio: coletiva (sempre em título ou final; às vezes nas outras fases)
HIST.afterTour = (t, place) => {
  if (!$s.CR || !t) return;
  const D = ctx(); D.t = t.name; D.o = 'eles';
  const big = (t.tier || 0) >= 5 || t.special;
  if (place === 0) queue(makeInterview('titulo', D, { big }));
  else if (place === 1) queue(makeInterview('vice', D, { big }));
  else if (Math.random() < (big ? .6 : .3)) queue(makeInterview('derrota', D, { big: false }));
};
// começo da semana: etapa de história marcada, história nova, coletiva antes de torneio grande ou entrevista de rotina
HIST.week = () => {
  const C = $s.CR; if (!C) return;
  const aw = absW(), q = (C.storyQ = C.storyQ || []);
  const due = q.findIndex(x => x.at <= aw);
  if (due >= 0) { const x = q.splice(due, 1)[0], st = STORIES[x.sid]; if (st && st.steps[x.step]) { queueStory(x.sid, x.step, x.D); return; } }
  const used = (C.storyUsed = C.storyUsed || {});
  if (Math.random() < .22) {
    const ids = Object.keys(STORIES).filter(id => STORIES[id].ok() && !(used[id] && aw - used[id] < 30) && !q.some(x => x.sid === id));
    if (ids.length) { const id = pick(ids); used[id] = aw; queueStory(id, 'a', ctx()); return; }
  }
  const p = pers();
  if (Math.random() < .09 + (C.fama || 0) / 800) { const D = ctx(); const kinds = ['vida', 'vida']; if (C.partner) kinds.push('parceiro'); if (C.feud || Object.keys(C.rivals || {}).length) kinds.push('rival'); queue(makeInterview(pick(kinds), D, { big: (C.fama || 0) >= 40 })); }
  // explosivo: provocações aparecem mais
  if (p.temp >= 70 && !C.feud && Math.random() < .08) queueStory('redes', 'a', ctx());
};
// inscrição num torneio grande: coletiva de abertura
HIST.preTour = (t) => { if (!$s.CR || !t || !((t.tier || 0) >= 6 || t.special) || Math.random() > .55) return; const D = ctx(); D.t = t.name; queue(makeInterview('pre', D, { big: true })); };
HIST.effects = persEffects;
function queueStory(sid, step, D) { const st = STORIES[sid], s = st.steps[step]; queue({ type: 'historia', sid, step, title: st.title, D, text: fill(s.t(), D), opts: s.o.map(o => ({ txt: fill(o[0], D) })) }); }

// ---------- vozes (síntese do navegador) ----------
const VOX = { list: [], ready: false };
function loadVoices() { try { const v = speechSynthesis.getVoices(); if (v && v.length) { VOX.list = v.filter(x => /^pt/i.test(x.lang)); VOX.ready = true; } } catch (e) {} }
if (typeof speechSynthesis !== 'undefined') { loadVoices(); try { speechSynthesis.onvoiceschanged = loadVoices; } catch (e) {} }
const voiceOn = () => typeof speechSynthesis !== 'undefined' && S.settings.voices !== false && !S.muted;
// fala com uma voz: g 'f' ou 'm' (procura uma voz que pareça do gênero pelo nome; senão muda o tom)
// falas gravadas (voz neural gerada por ferramentas/vozes/gerar.py): pasta rm/rf (repórter, fã) e jm/jf (jogador)
const REC_V = { idx: null, loading: false, cur: null, tok: 0 };
function fnv(s) { let x = 0x811c9dc5; for (const b of new TextEncoder().encode(s)) x = Math.imul(x ^ b, 0x01000193) >>> 0; return x.toString(16).padStart(8, '0'); }
function recIdx() { if (REC_V.idx || REC_V.loading) return; REC_V.loading = true; fetch(import.meta.env.BASE_URL + 'assets/voz/index.json').then(r => r.ok ? r.json() : null).then(j => { if (j) { REC_V.idx = {}; for (const k in j) REC_V.idx[k] = new Set(j[k]); } }).catch(() => {}); }
if (typeof window !== 'undefined' && typeof fetch !== 'undefined') recIdx();
// toca os pedaços (abertura + frase) em sequência; devolve false se faltar algum (aí usa a voz do navegador)
function sayRec(parts, pasta) {
  const I = REC_V.idx && REC_V.idx[pasta]; if (!I) return false;
  const hs = parts.filter(x => x && x.replace(/\(.*?\)/g, '').trim()).map(fnv); if (!hs.length || hs.some(x => !I.has(x))) return false;
  const tok = ++REC_V.tok, vs = S.settings.vol || {}, vol = clamp((vs.master == null ? 1 : vs.master) * (vs.voz == null ? .9 : vs.voz), 0, 1);
  const next = i => { if (tok !== REC_V.tok || i >= hs.length) return; const a = new Audio(import.meta.env.BASE_URL + 'assets/voz/' + pasta + '/' + hs[i] + '.ogg'); a.volume = vol; REC_V.cur = a; a.onended = () => setTimeout(() => next(i + 1), 90); a.play().catch(() => {}); };
  next(0); return true;
}
function say(text, g, who, parts, kind) {
  if (!voiceOn() || !text) return;
  if (parts && sayRec(parts, (kind || 'j') + (g === 'f' ? 'f' : 'm'))) return;
  try {
    const u = new SpeechSynthesisUtterance(text.replace(/\(.*?\)/g, '')), L = VOX.list.length ? VOX.list : [];
    const fem = /female|mulher|maria|luciana|francisca|vit[oó]ria|camila|helena|joana|raquel|fernanda|google português/i, masc = /male|homem|daniel|ricardo|ant[oô]nio|felipe|duarte|jo[aã]o/i;
    const byG = L.filter(v => (g === 'f' ? fem : masc).test(v.name)), v = byG.length ? byG[(who || 0) % byG.length] : L[(who || 0) % Math.max(1, L.length)];
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'pt-BR';
    u.pitch = (g === 'f' ? 1.15 : .9) + ((who || 0) % 3 - 1) * .06; u.rate = 1.04;
    const vs = S.settings.vol || {}, m = vs.master == null ? 1 : vs.master, vv = vs.voz == null ? .9 : vs.voz; u.volume = clamp(m * vv, 0, 1);
    speechSynthesis.speak(u);
  } catch (e) {}
}
const hush = () => { REC_V.tok++; if (REC_V.cur) { try { REC_V.cur.pause(); } catch (e) {} REC_V.cur = null; } try { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); } catch (e) {} };

// ---------- tela ----------
let EL = null;
function el() {
  if (EL) return EL;
  EL = document.createElement('div'); EL.id = 'crTalk'; EL.className = 'overlay talk-ov'; EL.hidden = true;
  EL.innerHTML = '<div class="card talk-card"><div class="talk-head"><span class="talk-ico"></span><div><div class="eyebrow talk-out"></div><b class="talk-rep"></b></div><button type="button" class="ghost xs talk-snd" title="Ligar ou desligar as vozes">🔊</button></div><p class="talk-q"></p><div class="talk-opts"></div><div class="talk-res" hidden><p class="talk-reply"></p><div class="talk-chips"></div><button type="button" class="cta talk-ok">Continuar</button></div></div>';
  document.body.appendChild(EL);
  EL.querySelector('.talk-ok').addEventListener('click', () => { hush(); closeTalk(); EL.hidden = true; if (HIST.rerender) HIST.rerender(); });
  EL.querySelector('.talk-snd').addEventListener('click', () => { S.settings.voices = S.settings.voices === false; if (HIST.saveSettings) HIST.saveSettings(); EL.querySelector('.talk-snd').textContent = S.settings.voices === false ? '🔇' : '🔊'; if (S.settings.voices === false) hush(); });
  EL.querySelector('.talk-opts').addEventListener('click', e => { const b = e.target.closest('[data-ta]'); if (!b) return; hush(); const T = answerTalk(+b.dataset.ta); if (!T) return; paintResult(T); });
  return EL;
}
function paintResult(T) {
  const E = el(); E.querySelector('.talk-opts').hidden = true;
  const R = E.querySelector('.talk-res'); R.hidden = false;
  E.querySelector('.talk-reply').textContent = T.type === 'entrevista' ? '"' + T.reply + '"' : T.reply;
  E.querySelector('.talk-chips').innerHTML = (T.chips || []).map(c => '<span class="talk-chip">' + c.replace(/</g, '&lt;') + '</span>').join('');
  if (T.type === 'entrevista') say(T.reply, $s.CR.me.fem ? 'f' : 'm', 1, T.vr, 'j');
}
// mostra a próxima fala da fila (chamado pela tela da carreira)
function renderTalk() {
  const C = $s.CR, E = el();
  const T = C && C.talks && C.talks[0];
  if (!T || S.careerActive || (document.getElementById('career').hidden && S.mode !== 'livre')) { E.hidden = true; return; }
  if (!E.hidden && E.dataset.k === String(C.talks.length) + T.q + T.text) return;
  E.dataset.k = String(C.talks.length) + T.q + T.text; E.hidden = false;
  E.querySelector('.talk-snd').textContent = S.settings.voices === false ? '🔇' : '🔊';
  const ent = T.type === 'entrevista';
  E.querySelector('.talk-ico').textContent = ent ? T.ico : '📖';
  E.querySelector('.talk-out').textContent = ent ? (T.big ? 'Coletiva · ' : 'Entrevista · ') + T.outlet : 'História · ' + T.title;
  E.querySelector('.talk-rep').textContent = ent ? T.rep : 'Você · ' + persWord();
  E.querySelector('.talk-q').textContent = ent ? T.q : T.text;
  const O = E.querySelector('.talk-opts'); O.hidden = false; E.querySelector('.talk-res').hidden = true;
  O.innerHTML = T.opts.map((o, i) => '<button type="button" class="ghost talk-opt" data-ta="' + i + '">' + (ent ? '<small>' + TONES[o.tone].chip + '</small>' : '') + o.txt.replace(/</g, '&lt;') + '</button>').join('');
  if (T.done) { paintResult(T); return; }
  hush(); if (ent) say(T.q, T.rg, REPORTERS.findIndex(r => r[0] === T.rep), T.vq, 'r'); // as histórias ficam só no texto (a voz do navegador soava caricata)
}
// quadro da personalidade (aba Jogador)
function persHTML() {
  const p = pers(), ef = persEffects();
  return '<p class="section-label">Personalidade · ' + persWord() + '</p><div class="pers">' + AXES.map(([k, a, b]) => '<div class="pers-row"><span>' + a + '</span><span class="pers-bar"><i style="left:' + p[k] + '%"></i></span><span>' + b + '</span></div>').join('') + '</div>'
    + '<p class="cr-note">Muda com as respostas em entrevistas e as escolhas nas histórias. ' + (ef.txt.length ? 'Efeitos agora: ' + ef.txt.join(' · ') + '.' : 'Equilibrado: sem efeitos.') + '</p>';
}
if (typeof window !== 'undefined') window.__pdoHist = { STORIES, QA, A_OPEN, Q_OPEN, makeInterview, queueStory, answerTalk, closeTalk, pers, persEffects, renderTalk, ctx };
export { HIST, renderTalk, persHTML, persEffects, say, hush };
