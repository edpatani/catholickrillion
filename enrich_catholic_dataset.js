const fs = require('fs');
const path = require('path');

const enrichments = {
  saints: {
    pew_warmer: [
      "Our Lady of Perpetual Help", "Our Lady of Vailankanni", "Our Lady of Mount Carmel",
      "Our Lady of Guadalupe", "Our Lady of Lourdes", "Our Lady of Fatima",
      "Louis de Montfort", "Gerard Majella", "Peregrine Laziosi", "Frederic Ozanam",
      "Charles de Foucauld", "Peter Faber"
    ],
    altar_server: [
      "Tarcisius", "Gabriel Possenti", "Fulton Sheen", "Andrew Dung-Lac",
      "Augustine Zhao Rong", "Joseph Vaz", "Alphonsa", "Kuriakose Elias Chavara",
      "Gonsalo Garcia", "Mariam Baouardy", "Sister Lucia", "Infant Jesus of Prague"
    ],
    theologian: [
      "Irenaeus of Lyon", "Isidore of Seville"
    ],
    doctor_of_the_church: [
      "Peter Chrysologus"
    ],
    aliases: {
      "our lady of perpetual help": "Our Lady of Perpetual Help",
      "perpetual help": "Our Lady of Perpetual Help",
      "our lady of perpetual succour": "Our Lady of Perpetual Help",
      "perpetual succour": "Our Lady of Perpetual Help",
      "our lady of vailankanni": "Our Lady of Vailankanni",
      "vailankanni": "Our Lady of Vailankanni",
      "our lady of good health": "Our Lady of Vailankanni",
      "good health": "Our Lady of Vailankanni",
      "velankanni": "Our Lady of Vailankanni",
      "our lady of mount carmel": "Our Lady of Mount Carmel",
      "mount carmel": "Our Lady of Mount Carmel",
      "our lady of czestochowa": "Mary",
      "black madonna": "Mary",
      "our lady of knock": "Mary",
      "our lady of sorrows": "Mary",
      "mater dolorosa": "Mary",
      "our lady of the rosary": "Mary",
      "our lady of good counsel": "Mary",
      "st isidore": "Isidore of Seville",
      "saint isidore": "Isidore of Seville",
      "isidore of seville": "Isidore of Seville",
      "isidore": "Isidore of Seville",
      "st peter chrysologus": "Peter Chrysologus",
      "peter chrysologus": "Peter Chrysologus",
      "st peregrine": "Peregrine Laziosi",
      "saint peregrine": "Peregrine Laziosi",
      "peregrine": "Peregrine Laziosi",
      "peregrine laziosi": "Peregrine Laziosi",
      "st gerard": "Gerard Majella",
      "saint gerard": "Gerard Majella",
      "gerard majella": "Gerard Majella",
      "gerard": "Gerard Majella",
      "st louis de montfort": "Louis de Montfort",
      "louis de montfort": "Louis de Montfort",
      "montfort": "Louis de Montfort",
      "st louis marie de montfort": "Louis de Montfort",
      "frederic ozanam": "Frederic Ozanam",
      "blessed frederic ozanam": "Frederic Ozanam",
      "ozanam": "Frederic Ozanam",
      "charles de foucauld": "Charles de Foucauld",
      "st charles de foucauld": "Charles de Foucauld",
      "brother charles": "Charles de Foucauld",
      "st peter faber": "Peter Faber",
      "peter faber": "Peter Faber",
      "pierre favre": "Peter Faber",
      "st tarcisius": "Tarcisius",
      "tarcisius": "Tarcisius",
      "fulton sheen": "Fulton Sheen",
      "bishop sheen": "Fulton Sheen",
      "venerable fulton sheen": "Fulton Sheen",
      "archbishop sheen": "Fulton Sheen",
      "andrew dung lac": "Andrew Dung-Lac",
      "st andrew dung lac": "Andrew Dung-Lac",
      "dung lac": "Andrew Dung-Lac",
      "augustine zhao rong": "Augustine Zhao Rong",
      "zhao rong": "Augustine Zhao Rong",
      "joseph vaz": "Joseph Vaz",
      "st joseph vaz": "Joseph Vaz",
      "st alphonsa": "Alphonsa",
      "alphonsa": "Alphonsa",
      "sister lucia": "Sister Lucia",
      "lucia dos santos": "Sister Lucia",
      "lucia of fatima": "Sister Lucia",
      "infant jesus": "Infant Jesus of Prague",
      "infant jesus of prague": "Infant Jesus of Prague",
      "baby jesus": "Infant Jesus of Prague"
    }
  },
  physical_ways_to_pray: {
    pew_warmer: [
      "Double Genuflection", "Double Genuflecting", "Holding Palms", "Holy Hour"
    ],
    altar_server: [
      "Veneration of the Cross", "Kneeling at the Communion Rail", "Touching Statues", "Benediction"
    ],
    aliases: {
      "double genuflection": "Double Genuflection",
      "double genuflect": "Double Genuflection",
      "double genuflecting": "Double Genuflection",
      "kneel on both knees": "Double Genuflection",
      "two knees": "Double Genuflection",
      "holy hour": "Holy Hour",
      "making a holy hour": "Holy Hour",
      "hour of adoration": "Holy Hour",
      "veneration of the cross": "Veneration of the Cross",
      "venerating the cross": "Veneration of the Cross",
      "kissing the cross": "Veneration of the Cross",
      "palms": "Holding Palms",
      "holding palms": "Holding Palms",
      "palm branches": "Holding Palms",
      "palm fronds": "Holding Palms",
      "waving palms": "Holding Palms",
      "communion rail": "Kneeling at the Communion Rail",
      "altar rail": "Kneeling at the Communion Rail",
      "kneeling at the rail": "Kneeling at the Communion Rail",
      "kneeling to receive": "Kneeling at the Communion Rail",
      "touching statues": "Touching Statues",
      "touching a statue": "Touching Statues",
      "touch statue": "Touching Statues",
      "benediction": "Benediction",
      "benediction of the blessed sacrament": "Benediction",
      "blessing with monstrance": "Benediction"
    }
  },
  worship_songs: {
    pew_warmer: [
      "Gentle Woman", "Holy Is His Name", "Sweet Sacrament Divine", "O Sanctissima",
      "Hail Holy Queen Enthroned Above"
    ],
    theologian: [
      "Alma Redemptoris Mater", "Ave Regina Caelorum", "Sub Tuum Praesidium"
    ],
    aliases: {
      "gentle woman": "Gentle Woman",
      "hail mary gentle woman": "Gentle Woman",
      "quiet face": "Gentle Woman",
      "holy is his name": "Holy Is His Name",
      "my soul proclaims the greatness of the lord": "Holy Is His Name",
      "sweet sacrament divine": "Sweet Sacrament Divine",
      "sweet sacrament": "Sweet Sacrament Divine",
      "o sanctissima": "O Sanctissima",
      "o most holy one": "O Sanctissima",
      "hail holy queen enthroned above": "Hail Holy Queen Enthroned Above",
      "salve regina caelitum": "Hail Holy Queen Enthroned Above",
      "alma redemptoris": "Alma Redemptoris Mater",
      "loving mother of the redeemer": "Alma Redemptoris Mater",
      "ave regina caelorum": "Ave Regina Caelorum",
      "hail queen of heaven": "Ave Regina Caelorum",
      "sub tuum praesidium": "Sub Tuum Praesidium",
      "we fly to thy patronage": "Sub Tuum Praesidium",
      "under your protection": "Sub Tuum Praesidium"
    }
  },
  types_of_prayers: {
    pew_warmer: [
      "Act of Faith", "Act of Hope", "Act of Love", "Grace After Meals", "Benediction"
    ],
    altar_server: [
      "Seven Sorrows Chaplet", "Athanasian Creed", "Roman Canon", "Holy Face Devotion"
    ],
    aliases: {
      "act of faith": "Act of Faith",
      "actus fidei": "Act of Faith",
      "act of hope": "Act of Hope",
      "actus spei": "Act of Hope",
      "act of love": "Act of Love",
      "act of charity": "Act of Love",
      "actus caritatis": "Act of Love",
      "grace after meals": "Grace After Meals",
      "thanksgiving after meals": "Grace After Meals",
      "grace after meal": "Grace After Meals",
      "benediction": "Benediction",
      "benediction of the blessed sacrament": "Benediction",
      "seven sorrows": "Seven Sorrows Chaplet",
      "chaplet of the seven sorrows": "Seven Sorrows Chaplet",
      "servite rosary": "Seven Sorrows Chaplet",
      "athanasian creed": "Athanasian Creed",
      "quicumque vult": "Athanasian Creed",
      "roman canon": "Roman Canon",
      "eucharistic prayer 1": "Roman Canon",
      "eucharistic prayer i": "Roman Canon",
      "holy face": "Holy Face Devotion",
      "holy face chaplet": "Holy Face Devotion"
    }
  },
  biblical_characters: {
    altar_server: [
      "Veronica", "Simon of Cyrene", "Dismas", "Longinus", "Baruch",
      "Susanna", "Cleopas", "Tabitha", "Malchus", "Claudia Procula", "Achior"
    ],
    aliases: {
      "veronica": "Veronica",
      "st veronica": "Veronica",
      "simon of cyrene": "Simon of Cyrene",
      "cyrene": "Simon of Cyrene",
      "dismas": "Dismas",
      "good thief": "Dismas",
      "penitent thief": "Dismas",
      "st dismas": "Dismas",
      "longinus": "Longinus",
      "st longinus": "Longinus",
      "centurion at the cross": "Longinus",
      "baruch": "Baruch",
      "susanna": "Susanna",
      "cleopas": "Cleopas",
      "emmaus disciple": "Cleopas",
      "tabitha": "Tabitha",
      "dorcas": "Tabitha",
      "malchus": "Malchus",
      "claudia procula": "Claudia Procula",
      "pilates wife": "Claudia Procula",
      "achior": "Achior",
      "magi": "Caspar",
      "three wise men": "Caspar",
      "wise men": "Caspar",
      "three kings": "Caspar"
    }
  },
  churches_in_singapore: {
    aliases: {
      "csc": "Catholic Spirituality Centre Chapel",
      "catholic spirituality centre": "Catholic Spirituality Centre Chapel",
      "catholic spirituality center": "Catholic Spirituality Centre Chapel",
      "csc chapel": "Catholic Spirituality Centre Chapel",
      "mount alvernia": "Mount Alvernia Hospital Chapel",
      "mount alvernia chapel": "Mount Alvernia Hospital Chapel",
      "carmelite monastery": "Carmelite Monastery Chapel",
      "carmelite chapel": "Carmelite Monastery Chapel",
      "carmelites": "Carmelite Monastery Chapel",
      "canossian chapel": "Canossian Convent Chapel",
      "canossa chapel": "Canossian Convent Chapel",
      "sji chapel": "St Joseph's Institution Chapel",
      "st patricks chapel": "St Patrick's School Chapel",
      "st patrick chapel": "St Patrick's School Chapel",
      "chij chapel": "CHIJ Toa Payoh Chapel",
      "ij chapel": "CHIJ Toa Payoh Chapel",
      "maris stella chapel": "Maris Stella Chapel",
      "montfort chapel": "Montfort Chapel",
      "seminary chapel": "Saint Francis Xavier Major Seminary Chapel",
      "sfxms": "Saint Francis Xavier Major Seminary Chapel",
      "sfxms chapel": "Saint Francis Xavier Major Seminary Chapel"
    }
  }
};

const questionsPath = path.join(__dirname, 'data', 'questions.json');
const raw = fs.readFileSync(questionsPath, 'utf8');
const qData = JSON.parse(raw);

for (const cat of qData.categories) {
  const enrich = enrichments[cat.id];
  if (!enrich) continue;

  const tiers = ['pew_warmer', 'altar_server', 'theologian', 'doctor_of_the_church', 'one_in_a_credillion'];
  for (const t of tiers) {
    if (!cat.tiers[t]) cat.tiers[t] = [];
    if (enrich[t]) {
      for (const item of enrich[t]) {
        if (!cat.tiers[t].includes(item)) {
          cat.tiers[t].push(item);
        }
      }
    }
  }

  if (!cat.aliases) cat.aliases = {};
  if (enrich.aliases) {
    for (const [k, v] of Object.entries(enrich.aliases)) {
      cat.aliases[k.toLowerCase().trim()] = v;
    }
  }
}

qData.version = "2.2.0";
qData.description = "Catholic Krillion 6-Category Edition: Fully Enriched Catholic Perspective & Tradition";

fs.writeFileSync(questionsPath, JSON.stringify(qData, null, 2), 'utf8');
console.log(`Updated ${questionsPath} with enriched Catholic dataset!`);

const bundlePath = path.join(__dirname, 'public', 'questions-bundle.js');
const bundleContent = `/**
 * Catholic Krillion - Static Questions Bundle
 * Auto-generated on ${new Date().toISOString()}
 */
window.KRILLION_QUESTIONS = ${JSON.stringify(qData, null, 2)};
`;
fs.writeFileSync(bundlePath, bundleContent, 'utf8');
console.log(`Updated ${bundlePath} with questions bundle!`);
