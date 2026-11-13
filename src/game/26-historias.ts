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
// respostas por tom e situação ({p} parceiro, {o} adversário, {t} torneio, {r} rival, {c} cidade)
const ANS = {
  vitoria: {
    humilde: ['Foi um jogo duro. {o} jogou muito, a gente teve um pouco mais de sorte nos pontos importantes.', 'Ainda tenho muito a melhorar, mas hoje a bola entrou. Respeito total pelo outro lado.', 'Vitória do trabalho. Tem muita gente por trás disso: técnico, família, quem acorda cedo comigo.'],
    confiante: ['A gente sabia que era superior. Era só jogar o nosso jogo.', 'Vim aqui para ganhar o torneio, não só um jogo. Isso foi só o começo.', 'Quando eu estou ligado, é difícil me parar. Hoje deu para ver.'],
    brinca: ['Ganhei, agora quero saber onde é o açaí mais perto dessa arena!', 'Minha mãe estava assistindo, então eu não podia perder. Ela cobra mais que técnico.', 'Teve um smash que nem eu sei como entrou. Vou dizer que foi treinado.'],
    tecnico: ['A chave foi a devolução de saque. Começamos a ler melhor o lado do backhand deles no segundo game.', 'Ajustamos a posição na rede e passamos a jogar mais curta cruzada. Funcionou.', 'O vento mudou no meio do set e a gente mudou o lob junto. Detalhe que decide.'],
    parceiro: ['Isso tem a cara de {p}. Segurou a defesa quando eu errei.', 'Sem {p} essa vitória não acontece. A gente se entende só no olhar.', 'Quero agradecer a {p}: hoje carregou a dupla nas costas.'],
    polemico: ['Achei a arbitragem fraca, mas nem isso nos parou.', 'Ouvi dizer que eles estavam confiantes. Agora podem ir para casa pensar.', 'Muita gente duvidou de mim. Fica o recado.'],
    emocao: ['Tô arrepiado. Esse público é demais, obrigado de verdade!', 'É por isso que eu jogo. Essa sensação não tem preço.'],
  },
  derrota: {
    humilde: ['Eles foram melhores, simples assim. Vou voltar para o treino.', 'Parabéns ao outro lado. Hoje eu fiquei devendo, mas é aprendizado.', 'Perder faz parte. Quem me ajudou até aqui merece mais, e eu vou dar mais.'],
    confiante: ['Foi um dia ruim, só isso. Na próxima a história é outra.', 'Não estou preocupado. Meu nível é de final, e eu vou provar.', 'Eles tiveram a vez deles. A minha volta logo.'],
    brinca: ['Pelo menos o bronzeado ficou ótimo.', 'Hoje a bola não quis conversa comigo. Vou ver se ela aceita um café amanhã.', 'Vou pedir para o técnico apagar esse jogo da memória.'],
    tecnico: ['Erramos muito na primeira bola depois do saque. Tem que corrigir o posicionamento.', 'Faltou variação: jogamos muito lob e eles estavam esperando.', 'O smash do fundo não entrou. Vou trabalhar a transição para a rede.'],
    parceiro: ['A culpa não é de {p}. Eu é que não encontrei meu jogo.', 'Vou ficar do lado de {p} sempre. Nós vamos voltar mais fortes juntos.'],
    polemico: ['Tem muita coisa errada nesse torneio, desde a quadra até a arbitragem.', 'Sinceramente, não acho que eles foram melhores. A gente se entregou.', 'O calendário é um absurdo, a gente chega destruído. Alguém tem que falar.'],
    reservado: ['Não tenho muito a dizer. Agora é descansar.', 'Prefiro não comentar o jogo hoje.'],
  },
  titulo: {
    humilde: ['Ainda não caiu a ficha. Agradeço a cada pessoa que torceu.', 'Esse título é de todo mundo que me ajudou desde as quadras do clube.', 'Ganhar aqui em {c} é um sonho. Obrigado, de coração.'],
    confiante: ['Eu falei no começo da semana que vinha para ganhar. Aí está.', 'É só o primeiro de muitos. Podem se acostumar.', 'Esse troféu tinha meu nome desde o sorteio da chave.'],
    brinca: ['Agora o troféu vai dormir na minha cama. Desculpa, travesseiro.', 'Vou comemorar com uma pizza tamanho família e zero culpa.', 'Alguém sabe como se leva um troféu desses no avião?'],
    tecnico: ['Fomos consistentes do primeiro ao último jogo. Pouquíssimos erros não forçados.', 'O plano foi o mesmo a semana toda: pressão na rede e curta quando eles recuam.'],
    parceiro: ['{p} é o melhor parceiro que eu podia ter. Esse troféu é nosso.', 'Quero dividir esse momento com {p}. Ninguém trabalhou mais que a gente.'],
    emocao: ['(com a voz embargada) Pensei em desistir no ano passado. Hoje eu tô aqui. Valeu a pena.', 'Dedico esse título à minha família. Sem eles eu não teria nem raquete.'],
    polemico: ['Muita gente não acreditava. Hoje quero ver quem vai falar.', 'Esse é o recado para quem disse que eu não aguentava pressão.'],
  },
  vice: {
    humilde: ['Chegar na final já é enorme. Parabéns aos campeões, mereceram.', 'Fico feliz pela semana. Faltou um pouco, mas estamos no caminho.'],
    confiante: ['Final é pouco para mim. Quero o troféu e vou buscar.', 'Perdi hoje, mas eles sabem que vão me encontrar de novo.'],
    brinca: ['Prata combina com a minha raquete, pelo menos.', 'Segundo lugar: o primeiro dos que perderam. Brincadeira, tô feliz!'],
    tecnico: ['Na final o detalhe decide. Eles foram mais agressivos na volta do saque.', 'Precisamos ajustar o lado da defesa quando o jogo aperta.'],
    parceiro: ['Sem {p} eu nem estaria aqui. Semana gigante da dupla.'],
    emocao: ['Dói perder uma final. Mas olha esse público... obrigado mesmo.'],
  },
  pre: {
    humilde: ['Vou jogo a jogo. A chave é muito forte e todo mundo pode ganhar.', 'Só quero fazer o meu melhor e aprender com os melhores.'],
    confiante: ['Vim para ganhar. Não tem outro objetivo.', 'Estou no meu melhor momento. Quem cruzar comigo vai ter trabalho.'],
    brinca: ['Meu objetivo principal é não errar o caminho do hotel. O resto é lucro.', 'Trouxe três raquetes e dez pares de óculos. Prioridades.'],
    tecnico: ['Treinamos muito a devolução de saque e a transição para a rede esta semana.', 'O vento aqui em {c} é traiçoeiro. Vamos usar mais bola baixa.'],
    parceiro: ['{p} está voando nos treinos. Confio demais na nossa dupla.'],
    polemico: ['Tem gente que só ganha por causa do sorteio da chave. Comigo não.', 'O ranking não mostra quem é melhor de verdade. Vou mostrar aqui.'],
  },
  vida: {
    humilde: ['Ainda sou a mesma pessoa de sempre, só com mais viagens.', 'Fico sem graça com elogio, mas agradeço muito.'],
    brinca: ['Fora da quadra eu sou um desastre na cozinha. Só sei fazer miojo e smash.', 'Meu maior rival é o despertador.'],
    tecnico: ['Durmo cedo, cuido da alimentação e assisto aos meus jogos. Detalhe vira resultado.', 'Treino físico quatro vezes por semana. O beach tennis pede muito do corpo.'],
    confiante: ['Quero ser número um do mundo e não tenho vergonha de dizer.', 'Quero que daqui a dez anos falem do meu nome no beach tennis.'],
    emocao: ['O que me move é a minha família e esse esporte que mudou a minha vida.'],
    reservado: ['Prefiro manter a vida pessoal longe das câmeras.', 'Sou mais de ficar em casa. Gosto de silêncio.'],
  },
};
// perguntas por situação
const QUES = {
  vitoria: ['Que vitória! O que fez a diferença contra {o}?', 'Vocês pareciam tranquilos o jogo todo. Foi planejado?', 'O que o técnico falou entre os games?', 'Qual foi o ponto mais bonito do jogo para você?', 'Como foi jogar com esse vento?', 'Você virou um jogo complicado. Como foi a cabeça na hora do aperto?', 'O público vibrou muito com vocês. Dá para sentir essa energia da quadra?', 'Próximo jogo já é amanhã. Como está o corpo?', 'Teve um momento em que o jogo pareceu escapar. O que mudou?', 'Vitória contra uma dupla de nível alto. Esse resultado muda alguma coisa para vocês?', 'Muita gente comentou o seu smash hoje. Foi o melhor golpe da partida?'],
  zebra: ['Ninguém apostava em vocês contra {o}. Qual o segredo da zebra?', 'Vitória sobre favoritos! Vocês acreditaram desde o início?', 'Os rankings diziam o contrário. Hoje vocês provaram o quê?'],
  derrota: ['O que faltou hoje contra {o}?', 'Teve uma chance clara no fim. O que aconteceu ali?', 'Vocês vão continuar juntos depois desse resultado?', 'O calor pesou hoje?', 'Uma derrota dura. Como você sai dessa partida?', 'Vocês pareciam abaixo do normal. Foi físico ou mental?', 'O que fica de lição desse torneio?', 'A torcida esperava mais. O que você diria para quem veio te ver?'],
  titulo: ['Campeões do {t}! O que passa pela cabeça agora?', 'Em algum momento você achou que não ia dar?', 'O que esse título muda no ranking?', 'Quem foi a primeira pessoa para quem você ligou?', 'Qual foi o ponto mais difícil da semana?', 'Esse é o título mais importante da sua carreira?', 'Para quem você dedica esse troféu?', 'Como vai ser a comemoração hoje?'],
  vice: ['Faltou pouco para o título. O que pesou na final?', 'Uma semana de grande nível, mas sem o troféu. Fica o gosto amargo?', 'O que você leva de positivo dessa final?'],
  pre: ['O {t} começa amanhã. Qual a expectativa?', 'Tem algum adversário que você prefere evitar na chave?', 'Você já jogou bem aqui antes. Isso ajuda?', 'Como está o corpo depois de tantas viagens?', 'A chave do {t} está pesada. Quem você vê como favorito?', 'Você chega em boa fase. Dá para pensar em título?', 'Como foi a preparação para o {t}?'],
  vida: ['Como é a sua rotina fora da quadra?', 'Qual atleta você admirava quando criança?', 'O que ninguém sabe sobre você?', 'Como você lida com as viagens e a saudade de casa?', 'Qual foi o momento mais difícil da sua carreira?', 'O que te motiva a acordar cedo para treinar?', 'Qual o seu sonho no beach tennis?', 'Muita gente te segue nas redes agora. Como lida com a fama?', 'Se não fosse atleta, o que você seria?'],
  rival: ['{r} disse que você não aguenta pressão. Quer responder?', 'Vocês e {r} viraram rivais. Existe amizade fora da quadra?', 'O próximo encontro com {r} pode decidir o ranking. Tem algum recado?'],
  parceiro: ['Como está a relação com {p}? Há boatos de separação.', '{p} vive grande fase. Isso pressiona você?', 'O que {p} tem que nenhum outro parceiro teve?'],
};
// quais tons cabem em cada situação
const TONE_SET = { vitoria: 'vitoria', zebra: 'vitoria', derrota: 'derrota', titulo: 'titulo', vice: 'vice', pre: 'pre', vida: 'vida', rival: 'pre', parceiro: 'vitoria' };

const Q_OPEN = { vitoria: ['', '', 'Parabéns! ', 'Rapidinho, antes do aquecimento: ', 'Com essa torcida toda… ', 'Ainda sem fôlego, né? '], zebra: ['', 'Que zebra! ', 'Ninguém esperava! '], derrota: ['', '', 'Sei que é um momento difícil, mas… ', 'Rapidinho: '],
  titulo: ['', 'Campeão! ', 'Que semana! ', 'Com o troféu na mão: '], vice: ['', 'Parabéns pela campanha. ', 'Semana enorme. '], pre: ['', 'Bem-vindo a {c}! ', 'Último treino antes da estreia. ', 'Você parece tranquilo. '],
  vida: ['', 'Num papo mais leve: ', 'Fora das quadras: ', 'Pergunta dos seguidores: '], rival: ['', 'Não dá para não perguntar: ', 'O assunto da semana: '], parceiro: ['', 'Sobre a dupla: ', 'Muita gente quer saber: '] };
const A_OPEN = { humilde: ['', '', 'Olha, ', 'Sinceramente, ', 'Primeiro, obrigado. '], confiante: ['', '', 'Vou ser direto: ', 'Sem falsa modéstia: ', 'Escuta: '], brinca: ['', '', '(rindo) ', 'Olha só… ', 'Vou contar um segredo: '],
  tecnico: ['', '', 'Taticamente, ', 'Olhando o jogo, ', 'Analisando com calma, '], polemico: ['', 'Vou falar o que penso: ', 'Ninguém fala, então eu falo: ', 'Desculpa, mas '], parceiro: ['', 'Antes de tudo: ', 'Isso aqui é dupla, então: '],
  reservado: ['', '', 'Hum… '], emocao: ['', '(respira fundo) ', '(emocionado) '] };
function fill(s, D) { return s.replace(/\{(\w)\}/g, (m, k) => D[k] || '').replace(/\s+/g, ' ').trim(); }
// monta uma entrevista: veículo, repórter, pergunta e 3 respostas de tons diferentes
function makeInterview(kind, D, extra) {
  const set = ANS[TONE_SET[kind] || 'vitoria'];
  let tones = Object.keys(set).filter(t => (t !== 'parceiro' || D.p) && (t !== 'polemico' || Math.random() < .85));
  tones.sort(() => Math.random() - .5); tones = tones.slice(0, 3);
  const [out, ico] = pickFresh(OUTLETS, 'o'), [rep, rg] = pickFresh(REPORTERS, 'r');
  return Object.assign({ type: 'entrevista', kind, outlet: out, ico, rep, rg, q: fill(pick(Q_OPEN[kind] || ['']) + pickFresh(QUES[kind], 'q' + kind), D),
    opts: tones.map(t => { const pre = pick(A_OPEN[t] || ['']), base = fill(pickFresh(set[t], 'a' + kind + t), D); return { tone: t, txt: pre && /[,:]\s*$/.test(pre) && !/^[A-Z]{2}/.test(base) ? pre + base.charAt(0).toLowerCase() + base.slice(1) : pre + base }; }) }, extra || {});
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
    const o = T.opts[i], tn = TONES[o.tone]; reply = o.txt;
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
function say(text, g, who) {
  if (!voiceOn() || !text) return;
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
const hush = () => { try { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); } catch (e) {} };

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
  if (T.type === 'entrevista') say(T.reply, $s.CR.me.fem ? 'f' : 'm', 1);
}
// mostra a próxima fala da fila (chamado pela tela da carreira)
function renderTalk() {
  const C = $s.CR, E = el();
  const T = C && C.talks && C.talks[0];
  if (!T || S.careerActive || document.getElementById('career').hidden) { E.hidden = true; return; }
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
  hush(); say(ent ? T.q : T.text, ent ? T.rg : 'm', ent ? REPORTERS.findIndex(r => r[0] === T.rep) : 0);
}
// quadro da personalidade (aba Jogador)
function persHTML() {
  const p = pers(), ef = persEffects();
  return '<p class="section-label">Personalidade · ' + persWord() + '</p><div class="pers">' + AXES.map(([k, a, b]) => '<div class="pers-row"><span>' + a + '</span><span class="pers-bar"><i style="left:' + p[k] + '%"></i></span><span>' + b + '</span></div>').join('') + '</div>'
    + '<p class="cr-note">Muda com as respostas em entrevistas e as escolhas nas histórias. ' + (ef.txt.length ? 'Efeitos agora: ' + ef.txt.join(' · ') + '.' : 'Equilibrado: sem efeitos.') + '</p>';
}
if (typeof window !== 'undefined') window.__pdoHist = { STORIES, QUES, ANS, makeInterview, queueStory, answerTalk, closeTalk, pers, persEffects, renderTalk, ctx };
export { HIST, renderTalk, persHTML, persEffects, say, hush };
