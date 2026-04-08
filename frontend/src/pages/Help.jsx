import { useState } from "react";
import { useSport } from "../context/SportContext";

const HELP_DATA = {
  ping_pong: {
    title: "Ping Pong",
    emoji: "\u{1F3D3}",
    ratingInfo: {
      system: "Elo",
      description: "Ping pong uses the Elo rating system. New players start at 1000. Win against a higher-rated player to gain more points.",
    },
    rules: [
      "A game is played to 11 points. You must win by 2 points.",
      "Each player serves 2 points in a row, then switches.",
      "At 10-10 (deuce), service alternates every point.",
      "A match is typically best of 5 or best of 7 games.",
      "The ball must bounce once on each side of the table.",
      "The serve must be tossed at least 6 inches and hit behind the end line.",
      "In doubles, partners must alternate hitting the ball.",
    ],
    shots: [
      { name: "Forehand Drive", desc: "Flat, fast topspin shot hit on the dominant side. The bread-and-butter attacking shot." },
      { name: "Backhand Drive", desc: "Topspin shot hit on the non-dominant side. Key for consistent rallying." },
      { name: "Push", desc: "A defensive backspin shot used to return short balls and keep the ball low." },
      { name: "Loop", desc: "Heavy topspin shot with a brushing motion. The primary attacking shot in modern table tennis." },
      { name: "Chop", desc: "Defensive backspin shot from mid-distance. Used by defensive players to vary the spin." },
      { name: "Smash", desc: "A powerful flat kill shot used to end the point on high balls." },
      { name: "Flick", desc: "A quick wrist snap to attack short balls over the net aggressively." },
      { name: "Block", desc: "A compact shot using the opponent's speed to redirect the ball. Minimal backswing." },
      { name: "Lob", desc: "A high, deep defensive shot with heavy topspin to buy time when pushed back." },
    ],
    singlesStrategy: [
      "Control the center of the table - it gives you the best angle coverage.",
      "Vary your serve placement and spin to keep your opponent guessing.",
      "Use the third-ball attack: serve short, read the return, then loop or drive.",
      "Target your opponent's weak side (usually backhand) with deep, fast balls.",
      "Change pace frequently - mix heavy topspin loops with flat drives and pushes.",
      "Move your opponent side to side with wide angle shots, then attack the open space.",
      "Stay close to the table for an aggressive game, or back off for a defensive chopping style.",
      "Keep your paddle angle closed for topspin, open for backspin returns.",
      "Watch the ball contact on your opponent's paddle to read the spin direction.",
      "Stay low and on your toes - good footwork is the foundation of every shot.",
    ],
    doublesStrategy: [
      "Partners must alternate shots - practice smooth transitions and footwork.",
      "After hitting, move out of your partner's way immediately (typically sidestep).",
      "Serve short to the middle to limit the receiver's angle options.",
      "Communicate with your partner about positioning before each point.",
      "Target the transition between opponents - hit to the middle to create confusion.",
      "Develop a consistent pattern: one player attacks while the other sets up.",
      "Practice the 'figure-8' footwork pattern to avoid colliding with your partner.",
    ],
    scoring: "Games are played to 11 points (win by 2). Matches are best of 5 or 7 games.",
    usefulLinks: [
      { name: "ITTF (International Table Tennis Federation)", url: "https://www.ittf.com", desc: "Official world governing body for table tennis" },
      { name: "ITTF World Rankings", url: "https://www.ittf.com/rankings/", desc: "Live world rankings for men and women" },
      { name: "USATT (USA Table Tennis)", url: "https://www.usatt.org", desc: "Official US governing body, find clubs, tournaments & ratings" },
      { name: "USATT Ratings", url: "https://usatt.justgo.com/", desc: "Look up official USATT player ratings" },
      { name: "WTT (World Table Tennis)", url: "https://worldtabletennis.com", desc: "Professional tour events, schedules & live streams" },
      { name: "TableTennisDaily", url: "https://www.tabletennisdaily.com", desc: "Tips, coaching videos, and community forums" },
      { name: "PongFinity (YouTube)", url: "https://www.youtube.com/@Pongfinity", desc: "Entertaining trick shots and ping pong content" },
      { name: "Tom Lodziak Coaching", url: "https://www.tomlodziak.com", desc: "Free coaching tips and technique guides" },
    ],
    proMenSingles: [
      { name: "Fan Zhendong", country: "China", rank: 1, note: "Powerful forehand loops and relentless attack" },
      { name: "Wang Chuqin", country: "China", rank: 2, note: "Explosive backhand and lightning-fast footwork" },
      { name: "Ma Long", country: "China", rank: 3, note: "6x World Champion, 'The Dragon', greatest of all time" },
      { name: "Hugo Calderano", country: "Brazil", rank: 4, note: "Incredible forehand power and athleticism" },
      { name: "Lin Shidong", country: "China", rank: 5, note: "Rising star with exceptional consistency" },
      { name: "Liang Jingkun", country: "China", rank: 6, note: "Strong all-round game with a devastating serve" },
      { name: "Tomokazu Harimoto", country: "Japan", rank: 7, note: "Youngest World Tour winner, aggressive two-wing attack" },
      { name: "Truls Moregardh", country: "Sweden", rank: 8, note: "Creative shot-maker and World Championship silver medalist" },
      { name: "Lin Gaoyuan", country: "China", rank: 9, note: "Tactical genius with a fast backhand counter" },
      { name: "Dimitrij Ovtcharov", country: "Germany", rank: 10, note: "Olympic medalist, fierce competitor with heavy topspin" },
    ],
    proMenDoubles: [
      { name: "Wang Chuqin / Fan Zhendong", country: "China", rank: 1, note: "Dominant duo combining explosive backhand and forehand power" },
      { name: "Liang Jingkun / Lin Gaoyuan", country: "China", rank: 2, note: "Perfect chemistry with complementary attacking styles" },
      { name: "Truls Moregardh / Anton Kallberg", country: "Sweden", rank: 3, note: "Swedish synergy with creative shot-making" },
      { name: "Tomokazu Harimoto / Hiroto Shinozuka", country: "Japan", rank: 4, note: "Japan's top pair with aggressive two-wing attack" },
      { name: "Hugo Calderano / Vitor Ishiy", country: "Brazil", rank: 5, note: "Brazilian power duo with great forehand attack" },
      { name: "Jang Woojin / Lim Jonghoon", country: "South Korea", rank: 6, note: "Olympic silver medalists, excellent coordination" },
      { name: "Felix Lebrun / Alexis Lebrun", country: "France", rank: 7, note: "Brother duo with telepathic understanding" },
      { name: "Lin Shidong / Xiang Peng", country: "China", rank: 8, note: "Rising Chinese pair with fierce consistency" },
      { name: "Patrick Franziska / Dimitrij Ovtcharov", country: "Germany", rank: 9, note: "Experienced German pair with Olympic pedigree" },
      { name: "Wong Chun Ting / Doo Hoi Kem", country: "Hong Kong", rank: 10, note: "Versatile pair with strong defensive skills" },
    ],
    proWomenSingles: [
      { name: "Sun Yingsha", country: "China", rank: 1, note: "Olympic champion, exceptional consistency and footwork" },
      { name: "Wang Manyu", country: "China", rank: 2, note: "Powerful forehand and dominant at the net" },
      { name: "Chen Meng", country: "China", rank: 3, note: "Olympic gold medalist, strong mental game" },
      { name: "Wang Yidi", country: "China", rank: 4, note: "Quick transitions and sharp backhand attack" },
      { name: "Hina Hayata", country: "Japan", rank: 5, note: "Stylish play with creative shot selection" },
      { name: "Mima Ito", country: "Japan", rank: 6, note: "Pioneer of backhand banana flick, fast attacker" },
      { name: "Shin Yubin", country: "South Korea", rank: 7, note: "Young talent with explosive two-wing attack" },
      { name: "Cheng I-Ching", country: "Chinese Taipei", rank: 8, note: "Veteran with great match experience and variety" },
      { name: "Bernadette Szocs", country: "Romania", rank: 9, note: "Aggressive style with unpredictable shot patterns" },
      { name: "Adriana Diaz", country: "Puerto Rico", rank: 10, note: "Pan American champion with solid all-round game" },
    ],
    proWomenDoubles: [
      { name: "Chen Meng / Wang Manyu", country: "China", rank: 1, note: "Powerhouse duo with dominant net presence" },
      { name: "Sun Yingsha / Wang Manyu", country: "China", rank: 2, note: "Olympic gold pair, unmatched coordination" },
      { name: "Hina Hayata / Mima Ito", country: "Japan", rank: 3, note: "Japan's best pair, creative and fast-paced" },
      { name: "Shin Yubin / Jeon Jihee", country: "South Korea", rank: 4, note: "Korean duo with explosive attack patterns" },
      { name: "Wang Yidi / Chen Xingtong", country: "China", rank: 5, note: "Aggressive Chinese pair with sharp transitions" },
      { name: "Cheng I-Ching / Li Yu-Jhun", country: "Chinese Taipei", rank: 6, note: "Experienced pair with tactical variety" },
      { name: "Bernadette Szocs / Sofia Polcanova", country: "Romania/Austria", rank: 7, note: "European duo with unpredictable styles" },
      { name: "Miyu Kihara / Miyuu Kihara", country: "Japan", rank: 8, note: "Rising Japanese pair with quick reflexes" },
      { name: "Adriana Diaz / Melanie Diaz", country: "Puerto Rico", rank: 9, note: "Sister duo with solid all-round game" },
      { name: "Jia Nan Yuan / Prithika Pavade", country: "France", rank: 10, note: "French pair with strong defensive play" },
    ],
  },

  tennis: {
    title: "Tennis",
    emoji: "\u{1F3BE}",
    ratingInfo: {
      system: "UTR (Universal Tennis Rating)",
      description: "Tennis uses the UTR system rated 1.00 to 16.50. New players start at 1.00 and climb as they win matches. A 2-point gap means ~76% expected win rate. Levels: 1-3 Beginner, 4-6 Intermediate, 7-9 Advanced, 10-12 Competitive, 13+ Elite/Pro.",
    },
    rules: [
      "A match is played in sets (best of 3 or best of 5).",
      "A set is won by the first player to win 6 games with a 2-game lead.",
      "At 6-6, a tiebreak is played to 7 points (win by 2).",
      "Points go: 0 (Love), 15, 30, 40, Game.",
      "At 40-40 (Deuce), a player must win 2 consecutive points.",
      "The server alternates every game. You get two serve attempts per point.",
      "The ball can only bounce once before being returned.",
      "In doubles, each team of 2 alternates shots during a rally.",
    ],
    shots: [
      { name: "Forehand", desc: "The most powerful groundstroke, hit on the dominant side with topspin. The primary weapon for most players." },
      { name: "Backhand", desc: "Groundstroke on the non-dominant side. Can be one-handed (more reach) or two-handed (more power)." },
      { name: "Serve", desc: "Starts every point. Types include flat (power), slice (curves), and kick (bounces high)." },
      { name: "Volley", desc: "A shot hit before the ball bounces, typically near the net. Requires quick reflexes." },
      { name: "Slice", desc: "Backspin shot that stays low and skids. Used defensively or as an approach shot." },
      { name: "Drop Shot", desc: "A soft, short shot that barely clears the net. Effective against baseline players." },
      { name: "Lob", desc: "A high, deep shot over an opponent at the net. Can be offensive (with topspin) or defensive." },
      { name: "Overhead/Smash", desc: "A powerful overhead shot to put away lobs. Similar motion to the serve." },
      { name: "Return of Serve", desc: "The most important shot after the serve. Read the spin and placement quickly." },
    ],
    singlesStrategy: [
      "Control the baseline and rally deep - push your opponent behind the baseline.",
      "Hit cross-court as your default shot - it's the highest margin and longest distance.",
      "Go down-the-line to change direction and catch your opponent moving the wrong way.",
      "Develop a strong first serve and a reliable second serve to start points on your terms.",
      "Approach the net on short balls - hit a deep approach shot then close in for the volley.",
      "Use the serve-plus-one pattern: serve wide, then attack the open court with your next shot.",
      "Mix up your shot selection - heavy topspin rallies, then surprise with a drop shot or slice.",
      "Target your opponent's weaker side repeatedly under pressure to force errors.",
      "Split step before every shot for better reaction time and balance.",
      "Read your opponent's body position and racket angle to anticipate their next shot.",
    ],
    doublesStrategy: [
      "The team that controls the net wins - both players should try to get to the net together.",
      "The net player's job is to poach and intercept - stay active and look for volleys.",
      "Serve down the T (center) to reduce the returner's angle for passing shots.",
      "The returner should aim cross-court to avoid the net player's poach.",
      "Use the I-formation or Australian formation to confuse the returner on big points.",
      "Communicate constantly - call 'switch', 'yours', 'mine' to avoid confusion.",
      "Lob over an aggressive net player to reset the point and bring them back.",
      "Target the weaker player on the opposing team - make them hit more balls under pressure.",
    ],
    scoring: "Points: Love (0), 15, 30, 40, Game. 6 games = 1 set. Best of 3 sets for most matches.",
    usefulLinks: [
      { name: "MyUTR (Universal Tennis Rating)", url: "https://www.utrsports.net/", desc: "Track your UTR rating, find players & events near you" },
      { name: "UTR Rankings", url: "https://www.utrsports.net/rankings", desc: "Live UTR singles and doubles rankings worldwide" },
      { name: "ATP Tour (Men's)", url: "https://www.atptour.com", desc: "Official men's professional tennis tour - rankings, stats & schedule" },
      { name: "WTA Tour (Women's)", url: "https://www.wtatennis.com", desc: "Official women's professional tennis tour - rankings, stats & schedule" },
      { name: "ITF (International Tennis Federation)", url: "https://www.itftennis.com", desc: "World governing body, rules, and junior/senior circuits" },
      { name: "USTA (US Tennis Association)", url: "https://www.usta.com", desc: "Find leagues, tournaments & NTRP ratings in the US" },
      { name: "Tennis Channel", url: "https://www.tennischannel.com", desc: "Live matches, highlights, and analysis" },
      { name: "Essential Tennis (YouTube)", url: "https://www.youtube.com/@EssentialTennis", desc: "Free coaching lessons and technique breakdowns" },
      { name: "Feel Tennis", url: "https://www.feeltennis.net", desc: "Technique tips focusing on feel and biomechanics" },
      { name: "Tennis Warehouse", url: "https://www.tennis-warehouse.com", desc: "Racquet reviews, string guides, and gear recommendations" },
    ],
    proMenSingles: [
      { name: "Jannik Sinner", country: "Italy", rank: 1, note: "World #1, powerful baseline game with incredible consistency" },
      { name: "Carlos Alcaraz", country: "Spain", rank: 2, note: "Youngest multi-Slam champion, explosive athleticism and drop shots" },
      { name: "Novak Djokovic", country: "Serbia", rank: 3, note: "24 Grand Slams, greatest returner ever, mental toughness legend" },
      { name: "Alexander Zverev", country: "Germany", rank: 4, note: "Towering serve and powerful forehand, Olympic gold medalist" },
      { name: "Daniil Medvedev", country: "Russia", rank: 5, note: "Unorthodox style, elite backhand and court coverage" },
      { name: "Taylor Fritz", country: "USA", rank: 6, note: "Big-serving American with a powerful forehand" },
      { name: "Casper Ruud", country: "Norway", rank: 7, note: "Clay court specialist with a lethal forehand" },
      { name: "Alex de Minaur", country: "Australia", rank: 8, note: "Lightning-fast footwork and never-give-up attitude" },
      { name: "Andrey Rublev", country: "Russia", rank: 9, note: "Fearless ball-striking with heavy topspin" },
      { name: "Grigor Dimitrov", country: "Bulgaria", rank: 10, note: "Elegant one-handed backhand and all-court game" },
    ],
    proMenDoubles: [
      { name: "Marcelo Arevalo / Mate Pavic", country: "El Salvador/Croatia", rank: 1, note: "Dominant team with powerful serve-and-volley game" },
      { name: "Marcel Granollers / Horacio Zeballos", country: "Spain/Argentina", rank: 2, note: "Masters of court positioning and chemistry" },
      { name: "Rohan Bopanna / Matthew Ebden", country: "India/Australia", rank: 3, note: "Australian Open champions with big serves" },
      { name: "Wesley Koolhof / Nikola Mektic", country: "Netherlands/Croatia", rank: 4, note: "Aggressive net play and quick reflexes" },
      { name: "Rajeev Ram / Joe Salisbury", country: "USA/UK", rank: 5, note: "Consistent duo with excellent return games" },
      { name: "Kevin Krawietz / Tim Puetz", country: "Germany", rank: 6, note: "German pair with strong coordination" },
      { name: "Santiago Gonzalez / Edouard Roger-Vasselin", country: "Mexico/France", rank: 7, note: "Versatile pair with great court coverage" },
      { name: "Ivan Dodig / Austin Krajicek", country: "Croatia/USA", rank: 8, note: "Roland Garros champions, experienced duo" },
      { name: "Neal Skupski / Michael Venus", country: "UK/New Zealand", rank: 9, note: "Quick exchanges and solid volleys" },
      { name: "Simone Bolelli / Andrea Vavassori", country: "Italy", rank: 10, note: "Italian pair with passionate net attacks" },
    ],
    proWomenSingles: [
      { name: "Aryna Sabalenka", country: "Belarus", rank: 1, note: "Dominant power game, Australian Open champion" },
      { name: "Iga Swiatek", country: "Poland", rank: 2, note: "4x French Open champion, incredible topspin forehand" },
      { name: "Coco Gauff", country: "USA", rank: 3, note: "US Open champion, athletic all-court game" },
      { name: "Jasmine Paolini", country: "Italy", rank: 4, note: "Breakout star with crafty shot-making and speed" },
      { name: "Elena Rybakina", country: "Kazakhstan", rank: 5, note: "Wimbledon champion, huge serve and flat groundstrokes" },
      { name: "Zheng Qinwen", country: "China", rank: 6, note: "Olympic gold medalist, powerful and fearless" },
      { name: "Jessica Pegula", country: "USA", rank: 7, note: "Consistent baseliner with excellent return game" },
      { name: "Emma Navarro", country: "USA", rank: 8, note: "Rising American talent with a strong net game" },
      { name: "Daria Kasatkina", country: "Russia", rank: 9, note: "Creative shot-maker with excellent variety" },
      { name: "Barbora Krejcikova", country: "Czech Republic", rank: 10, note: "Wimbledon champion, doubles expert turned singles star" },
    ],
    proWomenDoubles: [
      { name: "Su-Wei Hsieh / Elise Mertens", country: "Chinese Taipei/Belgium", rank: 1, note: "Incredible touch and tactical mastery" },
      { name: "Gabriela Dabrowski / Erin Routliffe", country: "Canada/New Zealand", rank: 2, note: "US Open champions with great chemistry" },
      { name: "Coco Gauff / Jessica Pegula", country: "USA", rank: 3, note: "American duo with powerful baseline games" },
      { name: "Sara Errani / Jasmine Paolini", country: "Italy", rank: 4, note: "Olympic gold medalists, Italian synergy" },
      { name: "Barbora Krejcikova / Katerina Siniakova", country: "Czech Republic", rank: 5, note: "Career Golden Slam in doubles, legendary pair" },
      { name: "Nicole Melichar-Martinez / Ellen Perez", country: "USA/Australia", rank: 6, note: "Strong serve-and-volley combination" },
      { name: "Lyudmyla Kichenok / Jelena Ostapenko", country: "Ukraine/Latvia", rank: 7, note: "Powerful and unpredictable at the net" },
      { name: "Caroline Dolehide / Desirae Krawczyk", country: "USA", rank: 8, note: "American pair with aggressive net approach" },
      { name: "Miyu Kato / Eri Hozumi", country: "Japan", rank: 9, note: "Quick reflexes and excellent coordination" },
      { name: "Asia Muhammad / Aldila Sutjiadi", country: "USA/Indonesia", rank: 10, note: "Consistent pair with solid fundamentals" },
    ],
  },

  pickleball: {
    title: "Pickleball",
    emoji: "\u{1F94F}",
    ratingInfo: {
      system: "UTR (Universal Tennis Rating)",
      description: "Pickleball uses the UTR system rated 1.00 to 16.50. New players start at 1.00. A 2-point gap means ~76% expected win rate. Levels: 1-3 Beginner, 4-6 Intermediate, 7-9 Advanced, 10-12 Competitive, 13+ Elite.",
    },
    rules: [
      "Games are played to 11 points (win by 2). Tournament games may go to 15 or 21.",
      "Only the serving team can score points.",
      "The serve must be underhand and hit diagonally cross-court.",
      "The ball must bounce once on each side before volleys are allowed (two-bounce rule).",
      "The non-volley zone (kitchen) is the 7-foot area on each side of the net.",
      "You cannot volley the ball while standing in or touching the kitchen line.",
      "In doubles, both players serve before the serve passes to the other team (except at the start).",
      "The server calls the score as: serving team score, receiving team score, server number (1 or 2).",
    ],
    shots: [
      { name: "Dink", desc: "A soft, controlled shot that arcs over the net into the opponent's kitchen. The most important shot in pickleball strategy." },
      { name: "Third Shot Drop", desc: "A soft drop shot hit on the 3rd shot of a rally (after serve and return) to approach the net." },
      { name: "Drive", desc: "A hard, flat groundstroke aimed at the opponent's body or feet. Used to apply pressure." },
      { name: "Volley", desc: "A punch shot hit out of the air near the net. Keep your paddle up and use a short, compact motion." },
      { name: "Lob", desc: "A high, deep shot over the opponents' heads. Best used sparingly when they crowd the net." },
      { name: "Erne", desc: "An advanced shot where you jump or run around the kitchen to volley from beside the net post." },
      { name: "Overhead Smash", desc: "A powerful overhead shot to put away high balls. Aim for the feet or open court." },
      { name: "Spin Serve", desc: "Adding topspin or sidespin to the serve to make it harder to return." },
      { name: "Reset", desc: "A soft block or dink used to slow down a fast rally and regain a neutral position." },
    ],
    singlesStrategy: [
      "Control the kitchen line - get there as fast as possible after the return.",
      "Use the third shot drop to transition from the baseline to the net.",
      "Keep the ball deep on returns to pin your opponent at the baseline.",
      "Be patient in dink rallies - wait for a high ball before attacking.",
      "Mix drives and drops on the third shot to keep your opponent off balance.",
      "Move your opponent side to side with cross-court dinks, then attack down the line.",
      "Use lobs sparingly but effectively when your opponent crowds the net.",
      "Serve deep to the backhand side to limit the returner's options.",
      "Aim for your opponent's feet - low balls are the hardest to return.",
      "Keep your paddle up and ready between shots for quicker reaction time.",
    ],
    doublesStrategy: [
      "Both players should get to the kitchen line together - that's the power position.",
      "Stack or switch formations to keep your forehand in the middle.",
      "Aim your dinks at the middle between opponents to create confusion about who takes it.",
      "The return of serve should go deep cross-court, then both players rush the net.",
      "Communicate clearly: call 'mine', 'yours', 'switch', and 'bounce it' on lobs.",
      "Target the opponent's backhand side or their feet with drives.",
      "Use the Erne (jumping around the kitchen) to surprise opponents on cross-court dinks.",
      "When both opponents are at the net, use a speed-up at the body of the weaker player.",
      "Reset with a soft block when you're under attack - don't try to out-power a speed-up.",
    ],
    scoring: "Games to 11 (win by 2). Only the serving team scores. In doubles, both players serve.",
    usefulLinks: [
      { name: "MyUTR (Universal Tennis Rating)", url: "https://www.utrsports.net/", desc: "Track your UTR rating for pickleball, find events & players" },
      { name: "USA Pickleball (USAP)", url: "https://usapickleball.org", desc: "Official US governing body - rules, ratings & tournaments" },
      { name: "USAP Player Ratings (DUPR)", url: "https://www.dupr.com", desc: "Dreamland Universal Pickleball Rating - track your rating" },
      { name: "PPA Tour", url: "https://www.ppatour.com", desc: "Professional Pickleball Association - pro tour events & rankings" },
      { name: "MLP (Major League Pickleball)", url: "https://www.majorleaguepickleball.net", desc: "Team-based professional league with draft format" },
      { name: "APP Tour", url: "https://www.theapp.global", desc: "Association of Pickleball Professionals - tournaments & rankings" },
      { name: "Pickleball Central", url: "https://www.pickleballcentral.com", desc: "Gear reviews, paddle guides, and equipment" },
      { name: "The Dink (Newsletter)", url: "https://www.thedinkpickleball.com", desc: "Daily pickleball news, tips, and community" },
      { name: "Selkirk TV (YouTube)", url: "https://www.youtube.com/@SelkirkTV", desc: "Pro matches, tutorials, and paddle reviews" },
      { name: "Places2Play", url: "https://www.places2play.org", desc: "Find pickleball courts and open play near you" },
    ],
    proMenSingles: [
      { name: "Ben Johns", country: "USA", rank: 1, note: "Dominant #1 player, exceptional touch and strategic genius" },
      { name: "Federico Staksrud", country: "Argentina", rank: 2, note: "Powerful drives and aggressive net play" },
      { name: "Tyson McGuffin", country: "USA", rank: 3, note: "Athletic and powerful, former racquetball champion" },
      { name: "Connor Garnett", country: "USA", rank: 4, note: "Consistent and smart player with great hands" },
      { name: "Julian Arnold", country: "USA", rank: 5, note: "Entertaining showman with elite skills and creativity" },
      { name: "Jack Sock", country: "USA", rank: 6, note: "Former ATP tennis pro, powerful serve and volleys" },
      { name: "Jay Devilliers", country: "USA", rank: 7, note: "Smooth player with excellent court positioning" },
      { name: "Collin Johns", country: "USA", rank: 8, note: "Doubles specialist, Ben Johns' brother and partner" },
      { name: "Dylan Frazier", country: "USA", rank: 9, note: "Young talent with quick hands and athleticism" },
      { name: "AJ Koller", country: "USA", rank: 10, note: "Power player with heavy drives and strong volleys" },
    ],
    proMenDoubles: [
      { name: "Ben Johns / Collin Johns", country: "USA", rank: 1, note: "Brother duo, most dominant doubles team in history" },
      { name: "Ben Johns / Federico Staksrud", country: "USA/Argentina", rank: 2, note: "Explosive power combined with strategic genius" },
      { name: "Dylan Frazier / AJ Koller", country: "USA", rank: 3, note: "Athletic pair with heavy drives and quick hands" },
      { name: "Matt Wright / Riley Newman", country: "USA", rank: 4, note: "Veteran duo with incredible court chemistry" },
      { name: "Tyson McGuffin / Jay Devilliers", country: "USA", rank: 5, note: "Powerful and smooth with great net coverage" },
      { name: "Julian Arnold / Connor Garnett", country: "USA", rank: 6, note: "Creative and consistent championship pair" },
      { name: "Jack Sock / Pablo Tellez", country: "USA/Mexico", rank: 7, note: "Tennis power meets pickleball finesse" },
      { name: "Thomas Wilson / Patrick Smith", country: "USA", rank: 8, note: "Solid fundamentals and reliable partnership" },
      { name: "JW Johnson / Dylan Frazier", country: "USA", rank: 9, note: "Young athletic duo with fast-paced game" },
      { name: "Hayden Patriquin / James Ignatowich", country: "Canada/USA", rank: 10, note: "Rising pair with aggressive dinking game" },
    ],
    proWomenSingles: [
      { name: "Anna Leigh Waters", country: "USA", rank: 1, note: "Youngest #1 ever, dominant in both singles and doubles" },
      { name: "Catherine Parenteau", country: "Canada", rank: 2, note: "Exceptional touch and strategic dinking game" },
      { name: "Anna Bright", country: "USA", rank: 3, note: "Athletic and aggressive, rising star of the tour" },
      { name: "Lea Jansen", country: "USA", rank: 4, note: "Powerful game with excellent hands at the net" },
      { name: "Jorja Johnson", country: "USA", rank: 5, note: "Young phenom with incredible consistency" },
      { name: "Irina Tereschenko", country: "USA", rank: 6, note: "Strong fundamentals and reliable doubles partner" },
      { name: "Salome Devidze", country: "Georgia", rank: 7, note: "International talent with a well-rounded game" },
      { name: "Jessie Irvine", country: "USA", rank: 8, note: "Tall player with reach advantage and smart play" },
      { name: "Paris Todd", country: "USA", rank: 9, note: "Former tennis player with heavy groundstrokes" },
      { name: "Jackie Kawamoto", country: "USA", rank: 10, note: "Quick and scrappy with never-give-up mentality" },
    ],
    proWomenDoubles: [
      { name: "Anna Leigh Waters / Anna Bright", country: "USA", rank: 1, note: "Young powerhouse duo dominating the women's game" },
      { name: "Catherine Parenteau / Lea Jansen", country: "Canada/USA", rank: 2, note: "Touch and power combined perfectly" },
      { name: "Jorja Johnson / Irina Tereschenko", country: "USA", rank: 3, note: "Consistent pair with excellent communication" },
      { name: "Lucy Kovalova / Callie Smith", country: "Slovakia/USA", rank: 4, note: "Experienced duo with great court coverage" },
      { name: "Jessie Irvine / Anna Bright", country: "USA", rank: 5, note: "Height and athleticism with aggressive play" },
      { name: "Paris Todd / Jackie Kawamoto", country: "USA", rank: 6, note: "Power and speed combo at the kitchen" },
      { name: "Salome Devidze / Catherine Parenteau", country: "Georgia/Canada", rank: 7, note: "International flair with strategic dinking" },
      { name: "Vivian Glozman / Maggie Brascia", country: "USA", rank: 8, note: "Rising pair with solid fundamentals" },
      { name: "Rachel Rohrabacher / Georgia Johnson", country: "USA", rank: 9, note: "Athletic duo with fast hands" },
      { name: "Mary Brascia / Etta Wright", country: "USA", rank: 10, note: "Young talent with great chemistry" },
    ],
  },
};

function Section({ title, children }) {
  return (
    <div className="mb-5">
      <h3 className="font-mono text-[10px] text-surface-400 uppercase tracking-widest mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

const medals = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];

function ProPlayersTable({ title, singlesPlayers, doublesPlayers }) {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState("singles");
  const players = mode === "singles" ? singlesPlayers : doublesPlayers;
  if (!players || players.length === 0) return null;
  const visible = expanded ? players : players.slice(0, 3);
  return (
    <div className="bg-surface-100/70 border border-surface-200 rounded-xl p-5">
      <Section title={title}>
        {/* Singles / Doubles Toggle */}
        <div className="flex gap-1 bg-surface-50 rounded-lg p-0.5 border border-surface-200 mb-3">
          <button
            onClick={() => { setMode("singles"); setExpanded(false); }}
            className={`flex-1 px-3 py-1 rounded-md font-mono text-[11px] font-semibold transition-all
              ${mode === "singles" ? "bg-surface-200 text-brand-300" : "text-surface-400 hover:text-surface-600"}`}
          >
            Singles
          </button>
          <button
            onClick={() => { setMode("doubles"); setExpanded(false); }}
            className={`flex-1 px-3 py-1 rounded-md font-mono text-[11px] font-semibold transition-all
              ${mode === "doubles" ? "bg-surface-200 text-brand-300" : "text-surface-400 hover:text-surface-600"}`}
          >
            Doubles
          </button>
        </div>
        <div className="space-y-1.5">
          {visible.map((p) => (
            <div
              key={p.rank}
              className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-surface-50/50"
            >
              <span className="font-display text-sm w-6 text-center shrink-0">
                {p.rank <= 3 ? medals[p.rank - 1] : <span className="text-surface-400">{p.rank}</span>}
              </span>
              <div className="flex-1 min-w-0">
                <span className="font-body text-sm text-surface-800">{p.name}</span>
                <span className="font-mono text-[10px] text-surface-400 ml-2">{p.country}</span>
              </div>
              <span className="font-body text-[11px] text-surface-500 hidden sm:block max-w-[200px] truncate">
                {p.note}
              </span>
            </div>
          ))}
        </div>
        {players.length > 3 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-3 w-full text-center py-1.5 rounded-lg bg-surface-50 border border-surface-200 hover:bg-surface-200/60 transition-all font-body text-xs text-surface-500 hover:text-surface-700"
          >
            {expanded ? "Show Less \u25B2" : `Show All ${players.length} Players \u25BC`}
          </button>
        )}
      </Section>
    </div>
  );
}

// Sport-specific theme colors
const SPORT_THEMES = {
  ping_pong: {
    accent: "text-orange-400",
    accentBg: "bg-orange-500/10",
    accentBorder: "border-orange-500/20",
    headerGradient: "bg-gradient-to-r from-orange-950/40 via-orange-900/20 to-transparent",
    cardBg: "bg-orange-950/10",
    cardBorder: "border-orange-800/20",
    ratingBg: "bg-orange-900/20",
    ratingBorder: "border-orange-700/30",
    numberColor: "text-orange-400",
    linkHover: "hover:border-orange-500/30",
    linkAccent: "text-orange-400",
    shotBg: "bg-orange-950/10",
    shotBorder: "border-orange-800/15",
    pageBg: "bg-[radial-gradient(ellipse_at_10%_0%,rgba(249,115,22,0.06)_0%,transparent_50%),radial-gradient(ellipse_at_90%_100%,rgba(234,88,12,0.04)_0%,transparent_50%)]",
  },
  tennis: {
    accent: "text-lime-400",
    accentBg: "bg-lime-500/10",
    accentBorder: "border-lime-500/20",
    headerGradient: "bg-gradient-to-r from-lime-950/40 via-green-900/20 to-transparent",
    cardBg: "bg-lime-950/10",
    cardBorder: "border-lime-800/20",
    ratingBg: "bg-green-900/20",
    ratingBorder: "border-green-700/30",
    numberColor: "text-lime-400",
    linkHover: "hover:border-lime-500/30",
    linkAccent: "text-lime-400",
    shotBg: "bg-lime-950/10",
    shotBorder: "border-lime-800/15",
    pageBg: "bg-[radial-gradient(ellipse_at_10%_0%,rgba(132,204,22,0.06)_0%,transparent_50%),radial-gradient(ellipse_at_90%_100%,rgba(101,163,13,0.04)_0%,transparent_50%)]",
  },
  pickleball: {
    accent: "text-yellow-400",
    accentBg: "bg-yellow-500/10",
    accentBorder: "border-yellow-500/20",
    headerGradient: "bg-gradient-to-r from-yellow-950/40 via-amber-900/20 to-transparent",
    cardBg: "bg-yellow-950/10",
    cardBorder: "border-yellow-800/20",
    ratingBg: "bg-amber-900/20",
    ratingBorder: "border-amber-700/30",
    numberColor: "text-yellow-400",
    linkHover: "hover:border-yellow-500/30",
    linkAccent: "text-yellow-400",
    shotBg: "bg-yellow-950/10",
    shotBorder: "border-yellow-800/15",
    pageBg: "bg-[radial-gradient(ellipse_at_10%_0%,rgba(234,179,8,0.06)_0%,transparent_50%),radial-gradient(ellipse_at_90%_100%,rgba(202,138,4,0.04)_0%,transparent_50%)]",
  },
};

export default function Help() {
  const { sport } = useSport();
  const data = HELP_DATA[sport] || HELP_DATA.ping_pong;
  const theme = SPORT_THEMES[sport] || SPORT_THEMES.ping_pong;

  return (
    <div className={`${theme.pageBg} -mx-5 -mt-6 px-5 pt-6 pb-2 min-h-[calc(100vh-80px)]`}>
      {/* Header with sport gradient */}
      <div className={`${theme.headerGradient} rounded-xl px-5 py-4 mb-6 border ${theme.cardBorder}`}>
        <div className="flex items-center gap-3">
          <span className="text-4xl drop-shadow-lg">{data.emoji}</span>
          <div>
            <h2 className="font-display text-2xl text-surface-900">{data.title} Guide</h2>
            <p className="font-body text-sm text-surface-500">Rules, shots, strategies, and pro players</p>
          </div>
        </div>
      </div>

      {/* Pro Players */}
      {(data.proMenSingles || data.proWomenSingles) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          <ProPlayersTable title={`\u{1F30D} World Top 10 Men`} singlesPlayers={data.proMenSingles} doublesPlayers={data.proMenDoubles} />
          <ProPlayersTable title={`\u{1F30D} World Top 10 Women`} singlesPlayers={data.proWomenSingles} doublesPlayers={data.proWomenDoubles} />
        </div>
      )}

      {/* Rating System */}
      <div className={`${theme.ratingBg} border ${theme.ratingBorder} rounded-xl p-5 mb-5`}>
        <div className="flex items-center gap-2 mb-2">
          <span className={`font-display text-sm ${theme.accent} font-bold`}>{data.ratingInfo.system}</span>
        </div>
        <p className="font-body text-sm text-surface-600 leading-relaxed">{data.ratingInfo.description}</p>
      </div>

      {/* Scoring */}
      <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-xl p-5 mb-5`}>
        <Section title="Scoring">
          <p className="font-body text-sm text-surface-700">{data.scoring}</p>
        </Section>
      </div>

      {/* Rules */}
      <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-xl p-5 mb-5`}>
        <Section title="Rules">
          <ul className="space-y-2">
            {data.rules.map((rule, i) => (
              <li key={i} className="flex gap-2.5 font-body text-sm text-surface-700">
                <span className={`${theme.numberColor} font-mono text-xs mt-0.5 shrink-0`}>{i + 1}.</span>
                <span className="leading-relaxed">{rule}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {/* Shots */}
      <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-xl p-5 mb-5`}>
        <Section title="Types of Shots">
          <div className="grid gap-3">
            {data.shots.map((shot, i) => (
              <div key={i} className={`${theme.shotBg} border ${theme.shotBorder} rounded-lg px-4 py-3`}>
                <div className={`font-display text-sm ${theme.accent} font-semibold mb-1`}>
                  {shot.name}
                </div>
                <p className="font-body text-xs text-surface-500 leading-relaxed">
                  {shot.desc}
                </p>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* Singles & Doubles Strategy side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Singles Strategy */}
        <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-xl p-5`}>
          <Section title={`${data.emoji} Singles Strategy`}>
            <ul className="space-y-2.5">
              {data.singlesStrategy.map((s, i) => (
                <li key={i} className="flex gap-2.5 font-body text-sm text-surface-700">
                  <span className={`${theme.numberColor} shrink-0 font-mono text-xs mt-0.5`}>{i + 1}.</span>
                  <span className="leading-relaxed">{s}</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>

        {/* Doubles Strategy */}
        <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-xl p-5`}>
          <Section title={`\u{1F465} Doubles Strategy`}>
            <ul className="space-y-2.5">
              {data.doublesStrategy.map((s, i) => (
                <li key={i} className="flex gap-2.5 font-body text-sm text-surface-700">
                  <span className={`${theme.numberColor} shrink-0 font-mono text-xs mt-0.5`}>{i + 1}.</span>
                  <span className="leading-relaxed">{s}</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>

      {/* Useful Links */}
      {data.usefulLinks && data.usefulLinks.length > 0 && (
        <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-xl p-5 mt-5`}>
          <Section title={`\u{1F517} Useful Links & Resources`}>
            <div className="grid gap-2">
              {data.usefulLinks.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-start gap-3 px-3 py-2.5 rounded-lg ${theme.shotBg} border ${theme.shotBorder} hover:bg-surface-200/40 ${theme.linkHover} transition-all group`}
                >
                  <span className={`${theme.linkAccent} shrink-0 mt-0.5 text-sm group-hover:scale-110 transition-transform`}>{"\u2197"}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`font-display text-sm text-surface-800 group-hover:${theme.accent} transition-colors`}>
                      {link.name}
                    </div>
                    <p className="font-body text-xs text-surface-500 leading-relaxed">
                      {link.desc}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}
