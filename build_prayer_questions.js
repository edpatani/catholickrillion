const fs = require('fs');
const path = require('path');

const categories = [
  {
    id: "intentions_for_intercession",
    title: "Who & What Catholics Intercede For",
    prompt: "People, needs, intentions, and crises that Catholics bring before God in intercessory prayer!",
    description: "Petitions brought before the Throne of Grace.",
    tiers: {
      pew_warmer: ["sick", "peace", "vocations", "families", "priests", "pope", "dying", "conversion", "poor", "students", "souls in purgatory"],
      altar_server: ["unborn", "refugees", "prisoners", "depression", "cancer patients", "broken marriages", "leaders", "youth", "unity", "end of war"],
      theologian: ["persecuted christians", "estranged children", "despair", "holy souls", "consecrated religious", "healthcare workers", "grieving families", "missionaries"],
      doctor_of_the_church: ["final perseverance", "reparation for sins", "salvation of souls", "hardened sinners", "agony in gethsemane", "spiritual dryness"],
      one_in_a_credillion: ["souls with no one to pray for them", "unity of all christians", "deliverance from generational wounds", "peace in jerusalem"]
    },
    aliases: {
      "the sick": "sick",
      "purgatory": "souls in purgatory",
      "holy souls": "souls in purgatory",
      "holy father": "pope",
      "our priests": "priests",
      "the pope": "pope",
      "peace in the world": "peace",
      "world peace": "peace",
      "the poor": "poor",
      "the dying": "dying",
      "the youth": "youth",
      "the unborn": "unborn",
      "pro life": "unborn",
      "healing": "sick",
      "conversions": "conversion"
    }
  },
  {
    id: "biblical_intercessors",
    title: "Great Intercessors of the Bible",
    prompt: "Figures in Sacred Scripture who stood in the gap and interceded before God on behalf of others!",
    description: "Holy men and women who pleaded for their people.",
    tiers: {
      pew_warmer: ["moses", "abraham", "mary", "jesus", "paul", "peter", "job", "esther", "david", "samuel"],
      altar_server: ["elijah", "stephen", "daniel", "jeremiah", "nehemiah", "centurion", "martha", "mary of bethany", "good thief"],
      theologian: ["aaron", "hur", "phinehas", "jairus", "syrophoenician woman", "blind bartimaeus", "anna the prophetess", "simeon"],
      doctor_of_the_church: ["onias", "melchizedek", "queen of sheba", "amos", "habakkuk", "judas maccabeus"],
      one_in_a_credillion: ["epaphras", "onesiphorus", "philemon", "baruch", "huldah"]
    },
    aliases: {
      "queen esther": "esther",
      "st paul": "paul",
      "st peter": "peter",
      "st stephen": "stephen",
      "our lady": "mary",
      "mother mary": "mary",
      "bartimaeus": "blind bartimaeus",
      "dismas": "good thief"
    }
  },
  {
    id: "patron_saints_for_intentions",
    title: "Saints Invoked for Specific Needs & Crises",
    prompt: "Beloved patron saints Catholics invoke for specific prayers, illnesses, and impossible situations!",
    description: "Heavenly patrons and advocates before God.",
    tiers: {
      pew_warmer: ["anthony", "jude", "joseph", "peregrine", "michael", "mary", "monica", "francis of assisi"],
      altar_server: ["dymphna", "rita", "gerard majella", "therese of lisieux", "christopher", "luke", "raphael", "benedict"],
      theologian: ["padre pio", "maximilian kolbe", "carlo acutis", "kateri tekakwitha", "john vianney", "faustina", "gianna molla"],
      doctor_of_the_church: ["camillus de lellis", "agatha", "drogo", "joseph of cupertino", "blase", "scholastica", "catherine of siena"],
      one_in_a_credillion: ["roch", "charbel makhlouf", "pier giorgio frassati", "gemma galgani", "teresa of calcutta", "moses the black"]
    },
    aliases: {
      "st anthony": "anthony",
      "st jude": "jude",
      "st joseph": "joseph",
      "st peregrine": "peregrine",
      "st michael": "michael",
      "st monica": "monica",
      "st dymphna": "dymphna",
      "st rita": "rita",
      "mother teresa": "teresa of calcutta",
      "st charbel": "charbel makhlouf",
      "blessed carlo acutis": "carlo acutis",
      "st therese": "therese of lisieux",
      "cure of ars": "john vianney"
    }
  },
  {
    id: "divine_mercy_and_hour_of_mercy",
    title: "Words in the Divine Mercy Chaplet & 3 PM Hour",
    prompt: "Words, invocations, and prayers from the Chaplet of Divine Mercy and 3:00 PM Hour of Mercy!",
    description: "The prayer dictated to St. Faustina for the salvation of the world.",
    tiers: {
      pew_warmer: ["mercy", "passion", "sorrowful", "jesus", "trust", "blood", "water", "father", "eternal", "world", "whole"],
      altar_server: ["fount", "atonement", "sins", "dying", "souls", "cross", "wounds", "holy god", "mighty", "immortal"],
      theologian: ["offering", "reconciliation", "ray", "vessel", "unceasing", "unfathomable", "heart", "fountain", "ocean"],
      doctor_of_the_church: ["diary", "faustina", "three oclock", "hour of mercy", "chaplet", "misericordia", "novena"],
      one_in_a_credillion: ["miserere nobis", "in totius mundi", "passio domini", "fount of mercy", "rays of pale and red"]
    },
    aliases: {
      "jesus i trust in you": "trust",
      "eternal father": "eternal",
      "sorrowful passion": "passion",
      "whole world": "whole",
      "holy mighty one": "mighty",
      "holy immortal one": "immortal"
    }
  },
  {
    id: "ways_and_forms_of_praying",
    title: "Ways & Forms of Catholic Prayer",
    prompt: "Postures, traditions, devotions, and methods Catholics use to pray and intercede!",
    description: "Expressions of Christian prayer and devotion.",
    tiers: {
      pew_warmer: ["rosary", "mass", "adoration", "kneeling", "sign of the cross", "grace before meals", "novena", "chaplet", "bedtime prayer"],
      altar_server: ["fasting", "prostration", "standing", "orans", "lectio divina", "praise and worship", "spiritual bouquet", "holy hour", "pilgrimage"],
      theologian: ["liturgy of the hours", "divine office", "examen", "contemplation", "meditation", "silent retreat", "jericho march", "intercession"],
      doctor_of_the_church: ["hesychasm", "jesus prayer", "mental prayer", "apophatic", "kataphatic", "tenebrae", "vigil", "night watch"],
      one_in_a_credillion: ["dark night of the soul", "interior castle", "prayer of quiet", "cloud of unknowing", "prayer of union", "colloquy"]
    },
    aliases: {
      "kneel": "kneeling",
      "prostrate": "prostration",
      "hours": "liturgy of the hours",
      "breviary": "liturgy of the hours",
      "daily examen": "examen",
      "eucharistic adoration": "adoration",
      "ignatian examen": "examen"
    }
  },
  {
    id: "adoration_and_eucharistic_presence",
    title: "Eucharistic Adoration & The Blessed Sacrament",
    prompt: "Words, objects, hymns, and moments experienced during Eucharistic Adoration and Holy Hours!",
    description: "Contemplating the Real Presence of Christ.",
    tiers: {
      pew_warmer: ["monstrance", "host", "altar", "candle", "incense", "kneel", "silence", "prayer", "jesus", "benediction"],
      altar_server: ["tabernacle", "luna", "humeral veil", "cope", "tantum ergo", "o salutaris hostia", "divine praises", "exposition", "reposition"],
      theologian: ["transubstantiation", "real presence", "perpetual adoration", "reparation", "thurible", "boat", "adoration chapel", "viaticum"],
      doctor_of_the_church: ["ciborium", "two knees", "holy hour", "nocturn", "lauda sion", "pange lingua", "verbum supernum"],
      one_in_a_credillion: ["tintinnabulum", "ombrellino", "pyx", "thabor", "ostensorium", "adoro te devote"]
    },
    aliases: {
      "blessed sacrament": "host",
      "eucharist": "host",
      "incense burner": "thurible",
      "tantum ergo sacramentum": "tantum ergo",
      "o salutaris": "o salutaris hostia"
    }
  },
  {
    id: "sacramentals_and_prayer_objects",
    title: "Sacramentals & Items Used When Praying",
    prompt: "Sacred articles, sacramentals, and physical objects Catholics use in personal and intercessory prayer!",
    description: "Sensory sacramentals and holy articles of prayer.",
    tiers: {
      pew_warmer: ["rosary", "crucifix", "holy water", "bible", "candle", "statue", "prayer card", "prayer journal", "rosary beads"],
      altar_server: ["brown scapular", "miraculous medal", "blessed salt", "incense", "olive wood cross", "blessed ashes", "palm branch"],
      theologian: ["st benedict medal", "green scapular", "thurible", "holy icon", "reliquary", "aspergillum", "chaplet beads"],
      doctor_of_the_church: ["prie dieu", "breviary", "komboskini", "holy oil", "cord of st joseph", "blessed medal", "prayer shawl"],
      one_in_a_credillion: ["agnus dei wax", "holy water font", "icon lamp", "bulla", "bugia", "carmelite scapular"]
    },
    aliases: {
      "holy water bottle": "holy water",
      "scapular": "brown scapular",
      "medal": "miraculous medal",
      "kneeler": "prie dieu",
      "benedict medal": "st benedict medal"
    }
  },
  {
    id: "cries_for_mercy_and_famous_prayers",
    title: "Scriptural Cries for Help & Famous Short Prayers",
    prompt: "Famous short cries of faith, petition, and mercy recorded in Scripture and Catholic tradition!",
    description: "Arrow prayers and cries of the heart.",
    tiers: {
      pew_warmer: ["lord have mercy", "jesus i trust in you", "save me", "amen", "alleluia", "forgive them", "our father", "hail mary"],
      altar_server: ["kyrie eleison", "mea culpa", "into your hands", "son of david", "i am not worthy", "remember me", "come holy spirit"],
      theologian: ["not my will but yours", "help my unbelief", "do whatever he tells you", "the one you love is sick", "god be merciful to me a sinner"],
      doctor_of_the_church: ["maranatha", "fiat mihi", "magnus dominus", "totus tuus", "de profundis", "miserere mei deus"],
      one_in_a_credillion: ["domine salvum me fac", "sitio", "consummatum est", "introibo ad altare dei", "da mihi animas"]
    },
    aliases: {
      "kyrie": "kyrie eleison",
      "jesus remember me": "remember me",
      "lord save me": "save me",
      "i thirst": "sitio",
      "it is finished": "consummatum est"
    }
  },
  {
    id: "words_in_our_father",
    title: "Words in the Our Father / Lord's Prayer",
    prompt: "Name words that appear in the traditional Catholic Lord's Prayer (Our Father)!",
    description: "Accessible prayer foundation taught by Christ Himself.",
    tiers: {
      pew_warmer: ["father", "heaven", "name", "kingdom", "bread", "earth", "daily", "day", "deliver", "evil", "amen"],
      altar_server: ["hallowed", "come", "done", "give", "forgive", "trespasses", "trespass", "against", "lead", "temptation"],
      theologian: ["art", "thy", "thine", "will", "debtors", "debts", "power", "glory", "forever"],
      doctor_of_the_church: ["pater", "noster", "panem", "quotidianum", "debita", "inducas", "malo", "sanctificetur", "regnum"],
      one_in_a_credillion: ["supersubstantial", "dimitte", "tentationem", "caelis", "epiousios", "debitis", "libera"]
    },
    aliases: {
      "our father": "father",
      "lord's prayer": "father",
      "debtor": "debtors",
      "debt": "debts",
      "forgiveness": "forgive",
      "trespassers": "trespass",
      "temptations": "temptation"
    }
  },
  {
    id: "mysteries_of_the_rosary",
    title: "Mysteries of the Most Holy Rosary",
    prompt: "Events and mysteries from the Joyful, Luminous, Sorrowful, and Glorious decades!",
    description: "Meditating on the life of Christ with Mary.",
    tiers: {
      pew_warmer: ["annunciation", "nativity", "crucifixion", "resurrection", "ascension", "visitation", "assumption", "coronation"],
      altar_server: ["baptism of jesus", "wedding at cana", "transfiguration", "scourging at the pillar", "crowning with thorns", "carrying of the cross", "pentecost"],
      theologian: ["presentation", "finding in the temple", "proclamation of kingdom", "institution of eucharist", "agony in the garden"],
      doctor_of_the_church: ["descent of holy spirit", "pieta", "sorrowful mysteries", "glorious mysteries", "joyful mysteries", "luminous mysteries"],
      one_in_a_credillion: ["transitus", "dormition of mary", "kenosis", "theotokos", "via dolorosa"]
    },
    aliases: {
      "cana": "wedding at cana",
      "baptism": "baptism of jesus",
      "cross carrying": "carrying of the cross",
      "scourging": "scourging at the pillar",
      "agony": "agony in the garden"
    }
  },
  {
    id: "titles_of_mary_in_prayer",
    title: "Titles of Our Lady Invoked in Intercession",
    prompt: "Beloved titles, patronages, and apparitions of the Blessed Virgin Mary invoked in prayer!",
    description: "Invoking the maternal intercession of the Mother of God.",
    tiers: {
      pew_warmer: ["mother of god", "our lady of lourdes", "our lady of fatima", "our lady of guadalupe", "queen of peace", "help of christians"],
      altar_server: ["undoer of knots", "comforter of the afflicted", "health of the sick", "refuge of sinners", "mother of perpetual help", "mystical rose"],
      theologian: ["ark of the covenant", "gate of heaven", "star of the sea", "morning star", "cause of our joy", "seat of wisdom", "mother of good counsel"],
      doctor_of_the_church: ["our lady of sorrows", "virgin most prudent", "tower of david", "house of gold", "vessel of honor", "queen of apostles"],
      one_in_a_credillion: ["our lady of czestochowa", "stella maris", "salus populi romani", "advocate of sinners", "mediatrix of all graces"]
    },
    aliases: {
      "untier of knots": "undoer of knots",
      "our lady of knotes": "undoer of knots",
      "guadalupe": "our lady of guadalupe",
      "fatima": "our lady of fatima",
      "lourdes": "our lady of lourdes",
      "mater dei": "mother of god"
    }
  },
  {
    id: "spiritual_warfare_and_protection",
    title: "Spiritual Warfare & The Armor of God",
    prompt: "Terms, weapons, prayers, and verses used in Christian spiritual warfare and protection!",
    description: "Putting on the full armor of God in prayer.",
    tiers: {
      pew_warmer: ["st michael prayer", "shield of faith", "sword of the spirit", "holy water", "prayer", "fasting", "cross", "blood of jesus"],
      altar_server: ["belt of truth", "breastplate of righteousness", "helmet of salvation", "shoes of peace", "st benedict medal", "binding and loosing"],
      theologian: ["armor of god", "deliverance", "spiritual battle", "vigilance", "discernment of spirits", "renouncing evil", "authority in christ"],
      doctor_of_the_church: ["minor exorcism", "casting out demons", "prince of heavenly host", "snares of the devil", "roaring lion", "victory of calvary"],
      one_in_a_credillion: ["saint michael chaplet", "sword of st michael", "vatican exorcism prayer", "sancte michael archangele", "spiritual armor"]
    },
    aliases: {
      "shield": "shield of faith",
      "sword": "sword of the spirit",
      "helmet": "helmet of salvation",
      "breastplate": "breastplate of righteousness",
      "michael prayer": "st michael prayer"
    }
  },
  {
    id: "praying_with_the_psalms",
    title: "Praying with the Psalms & Cries of David",
    prompt: "Words, images, and verses from the Book of Psalms used in daily and liturgical prayer!",
    description: "The prayer book of the Church given by the Holy Spirit.",
    tiers: {
      pew_warmer: ["shepherd", "valley", "lord", "refuge", "rock", "fortress", "praise", "mercy", "shadow", "light", "shield"],
      altar_server: ["green pastures", "overflowing cup", "out of the depths", "have mercy on me", "my soul thirsts", "under his wings", "dwelling place"],
      theologian: ["miserere", "de profundis", "restore unto me", "broken and contrite heart", "lift up your heads", "praise the lord o my soul"],
      doctor_of_the_church: ["hyssop", "clean heart", "horn of salvation", "staff and rod", "anointed my head", "morning watch", "right spirit"],
      one_in_a_credillion: ["as the deer pants for streams", "in the secret place of the most high", "how long o lord", "selah", "tehillim"]
    },
    aliases: {
      "psalm 23": "shepherd",
      "psalm 51": "miserere",
      "psalm 130": "de profundis",
      "psalm 91": "refuge",
      "the lord is my shepherd": "shepherd"
    }
  },
  {
    id: "litanies_of_the_church",
    title: "Traditional Litanies & Invocations",
    prompt: "Phrases, responses, and titles found in the traditional Catholic Litanies!",
    description: "Rhythmic petitions echoing through Church history.",
    tiers: {
      pew_warmer: ["pray for us", "have mercy on us", "lord hear our prayer", "hear us o lord", "lamb of god", "christ have mercy"],
      altar_server: ["deliver us o lord", "we beseech you hear us", "litany of the saints", "litany of humility", "litany of loreto", "litany of the sacred heart"],
      theologian: ["that others may be praised and i not", "that others may be chosen and i set aside", "heart of jesus burning with love", "terror of demons"],
      doctor_of_the_church: ["mirror of justice", "seat of wisdom", "tower of ivory", "litany of trust", "chaste guardian of the virgin"],
      one_in_a_credillion: ["agnus dei qui tollis peccata mundi", "miserere nobis", "parce nobis domine", "exaudi nos domine", "ora pro nobis"]
    },
    aliases: {
      "ora pro nobis": "pray for us",
      "kyrie": "christ have mercy",
      "litany of saints": "litany of the saints"
    }
  },
  {
    id: "prayers_for_the_holy_souls",
    title: "Prayers for the Deceased & Souls in Purgatory",
    prompt: "Words, devotions, and practices Catholics use to intercede for the holy souls in purgatory!",
    description: "Offering suffrages for our brothers and sisters awaiting glory.",
    tiers: {
      pew_warmer: ["eternal rest", "rest in peace", "light", "purgatory", "all souls", "mass", "prayer", "cemetery", "souls", "heaven"],
      altar_server: ["perpetual light shine upon them", "requiem", "indulgence", "holy sacrifice", "anniversary mass", "gregorian masses", "offering up"],
      theologian: ["de profundis", "st gertrude prayer", "release of souls", "purification", "suffering church", "poor souls"],
      doctor_of_the_church: ["suffrages for the dead", "cleansing flames", "treasury of merit", "absolution of the dead", "pious union of st joseph"],
      one_in_a_credillion: ["requiem aeternam dona eis domine", "lux perpetua luceat eis", "dies irae", "libera me domine", "refrigerium"]
    },
    aliases: {
      "holy souls": "souls",
      "requiescat in pace": "rest in peace",
      "rip": "rest in peace",
      "all souls day": "all souls",
      "st gertrude": "st gertrude prayer"
    }
  },
  {
    id: "charisms_and_holy_spirit_in_prayer",
    title: "The Holy Spirit & Charisms in Intercession",
    prompt: "Gifts, fruits, and experiences of the Holy Spirit during praise, worship, and intercession!",
    description: "Being led by the Spirit in power and truth.",
    tiers: {
      pew_warmer: ["tongues", "prophecy", "healing", "peace", "love", "joy", "praise", "worship", "fire", "wind", "dove"],
      altar_server: ["laying on of hands", "word of knowledge", "discernment", "prayer in the spirit", "surrender", "baptism in the holy spirit", "song of praise"],
      theologian: ["parrhesia", "tears of compunction", "word of wisdom", "miracles", "resting in the spirit", "holy boldness", "adoration"],
      doctor_of_the_church: ["epiclesis", "sevenfold gifts", "twelve fruits", "infused contemplation", "interior promptings", "living water"],
      one_in_a_credillion: ["groanings too deep for words", "charismata", "glossolalia", "sanctifying grace", "pneumatology"]
    },
    aliases: {
      "gift of tongues": "tongues",
      "holy spirit": "dove",
      "boldness": "parrhesia",
      "prayer language": "tongues"
    }
  },
  {
    id: "latin_prayers_and_chants",
    title: "Ancient Latin Words in Prayer & Intercession",
    prompt: "Latin words, ancient liturgical phrases, and traditional chants heard in Catholic prayer!",
    description: "The universal sacred language of Catholic prayer.",
    tiers: {
      pew_warmer: ["amen", "alleluia", "kyrie", "sanctus", "gloria", "agnus dei", "pater noster", "ave maria", "credo"],
      altar_server: ["mea culpa", "ora pro nobis", "pax vobiscum", "te deum", "salve regina", "requiem", "oremus", "sursum corda"],
      theologian: ["confiteor", "miserere", "anima christi", "tantum ergo", "pange lingua", "stabat mater", "veni creator spiritus"],
      doctor_of_the_church: ["sub tuum praesidium", "dies irae", "angelus domini", "panis angelicus", "regina caeli", "lauda sion"],
      one_in_a_credillion: ["per ipsum et cum ipso", "ite missa est", "ecce agnus dei", "non sum dignus", "mandatum novum"]
    },
    aliases: {
      "kyrie eleison": "kyrie",
      "our father in latin": "pater noster",
      "hail mary in latin": "ave maria"
    }
  },
  {
    id: "fruits_and_graces_of_prayer",
    title: "Graces, Virtues & Fruits Received Through Prayer",
    prompt: "Spiritual fruits, graces, and virtues that flow from deep and faithful intercession!",
    description: "The divine harvest produced in a praying soul.",
    tiers: {
      pew_warmer: ["peace", "hope", "love", "patience", "kindness", "healing", "faith", "forgiveness", "strength", "joy"],
      altar_server: ["humility", "consolation", "conversion", "deliverance", "perseverance", "trust", "generosity", "self control"],
      theologian: ["spiritual fortitude", "compunction of heart", "holy indifference", "conformity to god's will", "spiritual dryness", "zeal for souls"],
      doctor_of_the_church: ["heroic virtue", "dark night consolation", "unitive way", "illuminative way", "interior peace"],
      one_in_a_credillion: ["infused charity", "habitual grace", "actual grace", "mystical espousal", "spiritual betrothal"]
    },
    aliases: {
      "charity": "love",
      "fortitude": "spiritual fortitude",
      "inner peace": "peace"
    }
  },
  {
    id: "seven_sacraments",
    title: "The Seven Sacraments & Channels of Grace",
    prompt: "The Seven Sacraments of the Church and essential sacramental concepts!",
    description: "Visible signs instituted by Christ to give grace.",
    tiers: {
      pew_warmer: ["baptism", "confirmation", "eucharist", "confession", "marriage", "holy orders", "anointing of the sick"],
      altar_server: ["reconciliation", "penance", "matrimony", "last rites", "communion", "ordination", "priesthood"],
      theologian: ["transubstantiation", "real presence", "sacramental character", "matter and form", "absolution", "chrismation", "viaticum"],
      doctor_of_the_church: ["ex opere operato", "indelible mark", "epiclesis", "contrition", "attrition", "consummation", "valid and licit"],
      one_in_a_credillion: ["form and matter", "res et sacramentum", "sacramentum tantum", "res tantum", "anaphora", "mystagogia"]
    },
    aliases: {
      "holy communion": "eucharist",
      "reconciliation": "confession",
      "anointing": "anointing of the sick",
      "holy matrimony": "marriage"
    }
  },
  {
    id: "stations_of_the_cross",
    title: "The Stations of the Cross (Via Crucis)",
    prompt: "Events, figures, and prayers from the Fourteen Stations of the Cross!",
    description: "Walking with Jesus to Calvary in prayerful solidarity.",
    tiers: {
      pew_warmer: ["condemned", "cross", "falls", "mother", "simon", "veronica", "stripped", "crucified", "dies", "buried"],
      altar_server: ["simon of cyrene", "veronica wipes the face", "third fall", "second fall", "first fall", "women of jerusalem", "taken down from the cross"],
      theologian: ["via dolorosa", "pilate", "calvary", "golgotha", "tomb", "sepulchre", "pieta", "we adore you o christ"],
      doctor_of_the_church: ["joseph of arimathea", "nicodemus", "by your holy cross", "redeemed the world", "consolation of christ"],
      one_in_a_credillion: ["stabat mater dolorosa", "fourteen stations", "sancta mater", "via crucis", "lithostrotos"]
    },
    aliases: {
      "simon cyrene": "simon of cyrene",
      "veronicas veil": "veronica",
      "jesus dies": "dies",
      "jesus falls": "falls"
    }
  },
  {
    id: "patron_saints_for_students",
    title: "Patron Saints for Students, Campus & Youth",
    prompt: "Saints invoked by university students and young adults for study, exams, purity, and fellowship!",
    description: "Heavenly companions for the academic and spiritual journey.",
    tiers: {
      pew_warmer: ["thomas aquinas", "joseph of cupertino", "aloisio gonzaga", "carlo acutis", "john bosco", "therese of lisieux", "francis of assisi"],
      altar_server: ["pier giorgio frassati", "catherine of alexandria", "maria goretti", "dominic savio", "augustine", "ignatius of loyola"],
      theologian: ["albert the great", "john henry newman", "edith stein", "gemma galgani", "teresa of avila", "john paul ii"],
      doctor_of_the_church: ["gregory the great", "bede the venerable", "anselm", "robert bellarmine", "bonaventure", "basil"],
      one_in_a_credillion: ["tarcisius", "pedro calungsod", "jose luis sanchez del rio", "clelia barbieri", "chiara luce badano"]
    },
    aliases: {
      "st thomas": "thomas aquinas",
      "frassati": "pier giorgio frassati",
      "acutis": "carlo acutis",
      "jp2": "john paul ii",
      "newman": "john henry newman"
    }
  },
  {
    id: "beloved_traditional_prayers",
    title: "Beloved Traditional Catholic Prayers by Title",
    prompt: "Famous Catholic prayers, canticles, and intercessions known by their traditional titles!",
    description: "The cherished treasury of Christian prayer.",
    tiers: {
      pew_warmer: ["our father", "hail mary", "glory be", "act of contrition", "st michael prayer", "angel of god", "memorare", "apostles creed"],
      altar_server: ["angelus", "salve regina", "anima christi", "hail holy queen", "magnificat", "benedictus", "nunc dimittis", "divine praises"],
      theologian: ["litany of humility", "regina caeli", "te deum", "confiteor", "suscipe", "prayer of st francis", "breastplate of st patrick"],
      doctor_of_the_church: ["stabat mater", "de profundis", "veni creator spiritus", "tota pulchra es", "canticle of the sun", "pange lingua"],
      one_in_a_credillion: ["sub tuum praesidium", "chaplet of st michael", "golden arrow prayer", "auxilium christianorum", "dies irae"]
    },
    aliases: {
      "creed": "apostles creed",
      "guardian angel prayer": "angel of god",
      "prayer of saint francis": "prayer of st francis",
      "st michael": "st michael prayer",
      "hail mary prayer": "hail mary"
    }
  },
  {
    id: "times_and_occasions_to_pray",
    title: "Times, Hours & Occasions to Pray",
    prompt: "Times of day, liturgical hours, seasons, and moments when Catholics turn to prayer!",
    description: "Praying without ceasing through all seasons of life.",
    tiers: {
      pew_warmer: ["morning offering", "bedtime", "before meals", "during mass", "noon", "three oclock", "lent", "advent"],
      altar_server: ["first friday", "first saturday", "angelus hour", "holy hour", "divine mercy hour", "novena day", "before exams", "in temptation"],
      theologian: ["lauds", "vespers", "compline", "matins", "terce", "sext", "none", "vigil", "night watch"],
      doctor_of_the_church: ["triduum", "octave of easter", "ember days", "rogation days", "quarantore", "forty hours"],
      one_in_a_credillion: ["angelus bells", "great silence", "midnight office", "paschal vigil", "hour of gethsemane"]
    },
    aliases: {
      "grace before meals": "before meals",
      "grace": "before meals",
      "3pm": "three oclock",
      "3 pm": "three oclock",
      "morning": "morning offering",
      "bedtime prayer": "bedtime"
    }
  },
  {
    id: "intercessory_postures_and_gestures",
    title: "Physical Postures & Gestures in Prayer",
    prompt: "Bodily postures, sacred gestures, and physical expressions used in Catholic worship and prayer!",
    description: "Praying with body, mind, and spirit.",
    tiers: {
      pew_warmer: ["kneeling", "standing", "prostration", "sign of the cross", "folding hands", "striking breast", "sitting", "bowing"],
      altar_server: ["orans posture", "genuflection", "laying on of hands", "raising hands", "looking up", "holding hands", "pilgrimage walking"],
      theologian: ["metanoia", "proskynesis", "kissing the altar", "extended hands", "bowing head", "walking rosary"],
      doctor_of_the_church: ["orans", "prostratio", "genuflexio", "crux gemmata", "venia", "inclinatio profunda"],
      one_in_a_credillion: ["adoratio", "supplicatio", "catacomb posture", "cruciform prayer", "metany"]
    },
    aliases: {
      "genuflect": "genuflection",
      "prostrate": "prostration",
      "kneel": "kneeling",
      "mea culpa": "striking breast",
      "cross": "sign of the cross"
    }
  },
  {
    id: "corporal_and_spiritual_works_of_mercy",
    title: "Corporal & Spiritual Works of Mercy",
    prompt: "Acts of love and mercy from the 7 Corporal and 7 Spiritual Works of Mercy!",
    description: "Faith alive in works of intercession and charity.",
    tiers: {
      pew_warmer: ["feed the hungry", "give drink to thirsty", "clothe the naked", "shelter the homeless", "visit the sick", "visit the imprisoned", "bury the dead"],
      altar_server: ["pray for living and dead", "comfort the sorrowful", "counsel the doubtful", "admonish the sinner", "instruct the ignorant", "forgive offenses", "bear wrongs patiently"],
      theologian: ["spiritual mercy", "corporal mercy", "intercession for prisoners", "hospital visitation", "comforting mourning", "patience with difficult people"],
      doctor_of_the_church: ["works of mercy", "beatitudes", "matthew 25", "as you did to least of these", "almsgiving"],
      one_in_a_credillion: ["eleemosyna", "suffragium", "misericordiae opera", "visitation of orphans", "ransom of captives"]
    },
    aliases: {
      "pray for the dead": "pray for living and dead",
      "forgive injuries": "forgive offenses",
      "comfort the afflicted": "comfort the sorrowful"
    }
  },
  {
    id: "traditional_novenas_and_devotions",
    title: "Traditional Novenas & Catholic Devotions",
    prompt: "Cherished novenas, nine-day prayers, and traditional Catholic pious devotions!",
    description: "Unfailing prayers of ninefold intercession.",
    tiers: {
      pew_warmer: ["divine mercy novena", "st jude novena", "surrender novena", "holy spirit novena", "sacred heart novena", "st joseph novena"],
      altar_server: ["novena of grace", "54 day rosary novena", "our lady of knots novena", "st therese novena", "miraculous medal novena", "first fridays"],
      theologian: ["st anthony novena", "padre pio novena", "st peregrine novena", "first saturdays", "seven sorrows novena", "infant of prague novena"],
      doctor_of_the_church: ["30 day st joseph prayer", "perpetual novena", "novena of masses", "nine tuesdays of st anthony", "posadas"],
      one_in_a_credillion: ["novena to the holy face", "novena of the holy souls", "claudian novena", "carmelite novena", "st gertrude novena"]
    },
    aliases: {
      "surrender": "surrender novena",
      "st jude": "st jude novena",
      "divine mercy": "divine mercy novena",
      "rosary novena": "54 day rosary novena"
    }
  },
  {
    id: "intercession_for_the_sick_and_healing",
    title: "Prayers for Healing & The Sick",
    prompt: "Sacraments, patron saints, items, and prayers invoked when interceding for the sick!",
    description: "Bringing the infirm to the Divine Physician.",
    tiers: {
      pew_warmer: ["anointing of the sick", "healing", "hospital", "prayer", "lourdes water", "st peregrine", "jesus", "doctor", "recovery"],
      altar_server: ["viaticum", "laying on of hands", "blessed oil", "st luke", "st raphael", "caregivers", "st dymphna", "surrender of pain"],
      theologian: ["oil of the sick", "spiritual healing", "redemptive suffering", "offering up illness", "consolation of the afflicted", "peace of mind"],
      doctor_of_the_church: ["extreme unction", "last rites", "divine physician", "wholeness of body and soul", "visitation of the sick"],
      one_in_a_credillion: ["oleum infirmorum", "sanatio", "charism of healing", "lourdes miraculous spring", "anointing oil"]
    },
    aliases: {
      "anointing": "anointing of the sick",
      "last rites": "viaticum",
      "peregrine": "st peregrine",
      "lourdes": "lourdes water"
    }
  },
  {
    id: "the_surrender_novena_and_trust",
    title: "Surrender, Trust & Daily Consecration",
    prompt: "Words, mottos, and prayers of holy surrender, childlike trust, and consecration to God!",
    description: "Letting go and placing all burdens in God's hands.",
    tiers: {
      pew_warmer: ["surrender", "trust", "take care of everything", "jesus", "peace", "providence", "let go", "faith", "totus tuus"],
      altar_server: ["litany of trust", "surrender novena", "morning offering", "consecration", "suscipe", "st ignatius", "don dolindo"],
      theologian: ["o jesus i surrender myself to you", "take lord and receive", "holy indifference", "abandonment to divine providence", "childlike trust"],
      doctor_of_the_church: ["jean pierre de caussade", "servant of god dolindo ruotolo", "fiat voluntas tua", "confidence in god", "spiritual childhood"],
      one_in_a_credillion: ["don dolindo ruotolo", "o gesu mi abbandono a te", "pensaci tu", "fiat voluntas tua sicut in caelo", "consecratio"]
    },
    aliases: {
      "surrender novena": "surrender",
      "take care of it": "take care of everything",
      "ruotolo": "don dolindo",
      "dolindo": "don dolindo"
    }
  },
  {
    id: "intercession_for_vocations_and_priests",
    title: "Prayers for Vocations & The Priesthood",
    prompt: "Intentions, holy orders, and prayers for priests, religious vocations, and discernment!",
    description: "Praying for laborers in the Lord's vineyard.",
    tiers: {
      pew_warmer: ["priest", "seminarian", "bishop", "sister", "brother", "nun", "vocations", "harvest", "deacon", "holy orders"],
      altar_server: ["discernment", "seminary", "chastity", "obedience", "poverty", "chalice", "send laborers", "consecrated life"],
      theologian: ["harvest master", "st john vianney", "melchizedek", "spiritual fatherhood", "adoration for vocations", "sanctification of priests"],
      doctor_of_the_church: ["alter christus", "in persona christi", "priestly sanctity", "laborers for the harvest", "pastoral charity"],
      one_in_a_credillion: ["vocation director", "ad sum", "ordination rite", "consecrated virginity", "perpetual vows"]
    },
    aliases: {
      "priests": "priest",
      "seminarians": "seminarian",
      "nuns": "nun",
      "sisters": "sister",
      "vocations to the priesthood": "vocations"
    }
  },
  {
    id: "eucharistic_hymns_and_chants",
    title: "Eucharistic Hymns & Songs of Praise",
    prompt: "Beloved Catholic hymns and sacred songs sung during Adoration, Benediction, and Holy Mass!",
    description: "Singing praise before the Lord in the Blessed Sacrament.",
    tiers: {
      pew_warmer: ["tantum ergo", "o salutaris hostia", "holy god we praise thy name", "panis angelicus", "i am the bread of life", "down in adoration"],
      altar_server: ["pange lingua", "adoro te devote", "ave verum corpus", "humbly we adore thee", "o sacrament most holy", "sweet sacrament divine"],
      theologian: ["let all mortal flesh keep silence", "verbum supernum", "hidden god devoutly i adore thee", "godhead here in hiding", "lauda sion salvatorem"],
      doctor_of_the_church: ["o saving victim", "come adore the sacred host", "sing my tongue the savior's glory", "salve regina caelitum", "tota pulchra es"],
      one_in_a_credillion: ["custodes hominum psallimus angelos", "ave verum corpus natum", "adoro te devote latens deitas", "o salutaris hostia quae caeli pandis ostium"]
    },
    aliases: {
      "tantum ergo": "tantum ergo",
      "o salutaris": "o salutaris hostia",
      "adoro te": "adoro te devote",
      "holy god": "holy god we praise thy name",
      "panis angelicus": "panis angelicus"
    }
  }
];

const outputPath = path.join(__dirname, 'data', 'questions.json');
const data = {
  version: "2.0.0",
  description: "Catholic Krillion ('Credillion') - Intercessory Prayer Ministry Question Bank",
  categoriesCount: categories.length,
  categories
};

fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
console.log(`Successfully generated ${categories.length} prayer-focused categories in ${outputPath}`);
