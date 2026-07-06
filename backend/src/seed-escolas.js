// Cadastro das escolas municipais de Ensino Fundamental II de Itaitinga/CE.
// Uso:  npm run seed:escolas   (dentro da pasta backend)
//
// É IDEMPOTENTE e NÃO destrutivo: insere apenas as escolas que ainda não
// existem (comparando pelo nome), sem tocar em alunos/alertas/demais dados.
//
// Precisão das coordenadas (ver campo `precisao`):
//   - 'exata'      → prédio mapeado no OpenStreetMap (endereço completo).
//   - 'rua'        → logradouro localizado no OSM, mas sem o número exato.
//   - 'bairro'     → centroide do bairro no OpenStreetMap (aproximada).
//   - 'a_confirmar'→ bairro sem referência no OSM; usa o centro do município.
// Fonte das coordenadas: OpenStreetMap/Nominatim (jul/2026). Ajuste os pontos
// 'bairro'/'a_confirmar' quando tiver o GPS oficial de cada unidade.

import db from './db.js';

const MUNICIPIO = 'Itaitinga';
// Centro do município (para as unidades sem referência no OSM).
const SEDE = { latitude: -3.96577, longitude: -38.5298 };

const escolas = [
  // --- Coordenadas exatas do prédio (OpenStreetMap) ---
  { nome: 'Escola Dona Conceição', bairro: 'Genezaré',
    endereco: 'Rua Doutor Manuel Sátiro, 132 - Parque Genezaré',
    latitude: -3.9784968, longitude: -38.5327041, precisao: 'exata' },
  { nome: 'Escola Francisca de Moraes Ferrer', bairro: 'Ancuri',
    endereco: 'Rua Parque das Flores, 500 - Ancuri',
    latitude: -3.8800672, longitude: -38.5322433, precisao: 'exata' },
  { nome: 'Escola Francisco Sales Filho', bairro: 'Jabuti',
    endereco: 'Rua Mário Sales, 460 - Jabuti',
    latitude: -3.9220154, longitude: -38.5165191, precisao: 'exata' },
  { nome: 'Escola Galdino Assunção Filho', bairro: 'Riachão',
    endereco: 'Rua Laura de Souza, 33 - Parque Genezaré (Conj. Habitar Brasil)',
    latitude: -3.9958845, longitude: -38.5190528, precisao: 'exata' },
  { nome: 'Escola Henrique G Justa', bairro: 'Jabuti',
    endereco: 'Rua Sebastião Cajueiro, 797 - Jabuti',
    latitude: -3.9307551, longitude: -38.5162803, precisao: 'exata' },
  { nome: 'Escola Jardim de Fátima', bairro: 'Barrocão',
    endereco: 'Rua Pereira Coutinho - Barrocão',
    latitude: -3.8962555, longitude: -38.5155762, precisao: 'exata' },
  { nome: 'Escola Manuel Machado', bairro: 'Vila Machado',
    endereco: 'Rua João Florindo Rodrigues, 101 - Vila Machado',
    latitude: -3.9742342, longitude: -38.5411150, precisao: 'exata' },
  { nome: 'Escola Valmique Sampaio', bairro: 'Centro',
    endereco: 'Rua Josmo Gurgel Araújo, 1256 - Antônio Miguel / Centro',
    latitude: -3.9703930, longitude: -38.5300749, precisao: 'exata' },

  // --- Aproximada pelo centroide do bairro (OpenStreetMap) ---
  { nome: 'Escola Elias de Sousa', bairro: 'Genezaré',
    endereco: 'Genezaré — localização aproximada (bairro)',
    latitude: -3.9771129, longitude: -38.5319652, precisao: 'bairro' },
  { nome: 'Escola Geraldo Batista de Lima', bairro: 'Parque Antônio Miguel',
    endereco: 'Parque Antônio Miguel — localização aproximada (bairro)',
    latitude: -3.9817713, longitude: -38.5313704, precisao: 'bairro' },
  { nome: 'Escola Lídia Alves Cavalcante', bairro: 'Parque Santo Antônio',
    endereco: 'Parque Santo Antônio — localização aproximada (bairro)',
    latitude: -3.9635851, longitude: -38.5247135, precisao: 'bairro' },
  { nome: 'Escola Laura da Costa Lima', bairro: 'Parque Santo Antônio',
    endereco: 'Rua Francisco Alves França, 486 - Parque Santo Antônio',
    latitude: -3.9636104, longitude: -38.5244189, precisao: 'exata' },
  { nome: 'Escola Manoel Ferreira Gomes', bairro: 'Parque Dom Pedro',
    endereco: 'Parque Dom Pedro — localização aproximada (bairro)',
    latitude: -3.9088043, longitude: -38.5079525, precisao: 'bairro' },
  { nome: 'Escola Manoel Novais de Oliveira', bairro: 'Carapió',
    endereco: 'Carapió — localização aproximada (bairro)',
    latitude: -3.9655627, longitude: -38.5557841, precisao: 'bairro' },
  { nome: 'Escola Manoel Rodrigues de Paiva', bairro: 'Caracanga',
    endereco: 'Caracanga — localização aproximada (bairro)',
    latitude: -3.9415302, longitude: -38.5501809, precisao: 'bairro' },

  // --- Sem referência no OSM: usa o centro do município (a confirmar) ---
  { nome: 'Escola Francisca Ferreira Siqueira', bairro: 'Gereraú',
    endereco: 'Av. Cel. Antônio Ferreira, 440 - Gereraú',
    latitude: -3.9166830, longitude: -38.5406533, precisao: 'rua' },
  // Endereço informado, mas a via não está no OSM de Itaitinga → GPS a confirmar.
  { nome: 'Escola Horácio Alves Ferreira', bairro: 'Vila Nova',
    endereco: 'Av. Cruzeiro do Sul, 612 - Vila Nova (GPS a confirmar)',
    latitude: SEDE.latitude, longitude: SEDE.longitude, precisao: 'a_confirmar' },
  { nome: 'Escola Santa Terezinha', bairro: 'Ponta da Serra',
    endereco: 'Av. Lídia Alves Cavalcante, 2022 - Ponta da Serra',
    latitude: -3.9580516, longitude: -38.5376546, precisao: 'rua' },
];

const existePorNome = db.prepare('SELECT id FROM escolas WHERE nome = ?');
const inserir = db.prepare(`
  INSERT INTO escolas (nome, municipio, endereco, latitude, longitude)
  VALUES (@nome, @municipio, @endereco, @latitude, @longitude)
`);

let inseridas = 0;
let existentes = 0;
const aplicar = db.transaction(() => {
  for (const e of escolas) {
    if (existePorNome.get(e.nome)) {
      existentes++;
      continue;
    }
    inserir.run({
      nome: e.nome,
      municipio: MUNICIPIO,
      endereco: e.endereco,
      latitude: e.latitude,
      longitude: e.longitude,
    });
    inseridas++;
  }
});
aplicar();

const porPrecisao = escolas.reduce((acc, e) => {
  acc[e.precisao] = (acc[e.precisao] || 0) + 1;
  return acc;
}, {});

console.log(
  `Escolas de Itaitinga: ${inseridas} cadastrada(s), ${existentes} já existente(s) ` +
  `(puladas). Precisão dos pontos → exata: ${porPrecisao.exata || 0}, ` +
  `bairro: ${porPrecisao.bairro || 0}, a confirmar: ${porPrecisao.a_confirmar || 0}.`
);
