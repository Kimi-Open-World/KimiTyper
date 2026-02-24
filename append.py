import re

# Read printed chapter 55
chapter_55 = """    {
      id: 'chapter-55',
      name: 'Chapter 55',
      description: '词汇 (附加)',
      words: [
        { id: 1078, word: 'aachen', phonetic: '/aachen/', meaning: 'n./v. aachen', example: 'Aachen is known for its technical university.', exampleTranslation: '亚琛以其技术大学而闻名。' },
        { id: 1079, word: 'aalii', phonetic: '/aalii/', meaning: 'n./v. aalii', example: 'The aalii bush thrives in dry environments.', exampleTranslation: 'Aalii 灌木在干燥的环境中茁壮成长。' },
        { id: 1080, word: 'aaliyah', phonetic: '/aaliyah/', meaning: 'n./v. aaliyah', example: 'The name Aaliyah is often used for girls in English-speaking countries.', exampleTranslation: 'Aaliyah 这个名字经常用于英语国家的女孩。' },
        { id: 1081, word: 'aalst', phonetic: '/aalst/', meaning: 'n./v. aalst', example: 'Aalst lies on the Dender river in East Flanders.', exampleTranslation: '阿尔斯特位于东佛兰德斯的登德尔河畔。' },
        { id: 1082, word: 'aalto', phonetic: '/aalto/', meaning: 'n./v. aalto', example: 'Electromagnetic waves propagate through vacuum.', exampleTranslation: '电磁波通过真空传播。' },
        { id: 1083, word: 'aardvark', phonetic: '/aardvark/', meaning: 'n./v. aardvark', example: 'Nocturnal foraging by aardvarks predominates in savanna regions.', exampleTranslation: '土豚在夜间觅食在稀树草原地区占主导地位。' },
        { id: 1084, word: 'aardvarks', phonetic: '/aardvarks/', meaning: 'n./v. aardvarks', example: 'Aardvarks are mammals native to Africa.', exampleTranslation: '土豚是非洲原产的哺乳动物。' },
        { id: 1085, word: 'aardwolf', phonetic: '/aardwolf/', meaning: 'n./v. aardwolf', example: 'The aardwolf feeds primarily on termites.', exampleTranslation: '土狼主要以白蚁为食。' },
        { id: 1086, word: 'aarhus', phonetic: '/aarhus/', meaning: 'n./v. aarhus', example: 'Aarhus is a coastal city on the Jutland peninsula.', exampleTranslation: '奥胡斯是日德兰半岛的一座沿海城市。' },
        { id: 1087, word: 'aaron', phonetic: '/aaron/', meaning: 'n./v. aaron', example: 'The given name Aaron appears in biblical and modern texts.', exampleTranslation: '亚伦这个名字出现在圣经和现代文本中。' },
        { id: 1088, word: 'aave', phonetic: '/aave/', meaning: 'n./v. aave', example: 'In the study, the Aave protocol was assessed for systemic risk under high volatility in crypto markets.', exampleTranslation: '在该研究中，评估了 Aave 协议在加密货币市场高波动性下的系统性风险。' },
        { id: 1089, word: 'abaci', phonetic: '/abaci/', meaning: 'n./v. abaci', example: 'Ancient merchants used abaci to tally taxes and trade goods.', exampleTranslation: '古代商人使用算盘来计算税收和交易货物。' },
        { id: 1090, word: 'aback', phonetic: '/aback/', meaning: 'n./v. aback', example: 'The sails were aback to reduce forward speed.', exampleTranslation: '帆向后退以降低前进速度。' },
        { id: 1091, word: 'abactinal', phonetic: '/abactinal/', meaning: 'n./v. abactinal', example: 'The abactinal surface of the starfish was examined.', exampleTranslation: '检查了海星的反面。' },
        { id: 1092, word: 'abacus', phonetic: '/abacus/', meaning: 'n./v. abacus', example: 'Calculation with an abacus.', exampleTranslation: '用算盘计算。' },
        { id: 1093, word: 'abae', phonetic: '/abae/', meaning: 'n./v. abae', example: 'No clear sample available.', exampleTranslation: '没有可用的清晰样品。' },
        { id: 1094, word: 'abaft', phonetic: '/abaft/', meaning: 'n./v. abaft', example: 'The sensor is positioned abaft the hull to minimize interference.', exampleTranslation: '传感器位于船体后方，以尽量减少干扰。' },
        { id: 1095, word: 'abalone', phonetic: '/abalone/', meaning: 'n./v. abalone', example: 'Abalone populations are studied for growth and reproduction.', exampleTranslation: '研究鲍鱼种群的生长和繁殖。' },
        { id: 1096, word: 'abalones', phonetic: '/abalones/', meaning: 'n./v. abalones', example: 'Abalones are harvested commercially in offshore Pacific waters.', exampleTranslation: '鲍鱼在太平洋近海水域进行商业捕捞。' },
        { id: 1097, word: 'abampere', phonetic: '/abampere/', meaning: 'n./v. abampere', example: 'The current is expressed in abamperes.', exampleTranslation: '电流以安培表示。' },
      ],
    },
"""

with open('src/data/books.ts', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("wordCount: 1077", "wordCount: 1097")
text = text.replace("共 1077 词", "共 1097 词")

insert_pos = text.rfind("  ],")
new_text = text[:insert_pos] + chapter_55 + text[insert_pos:]

with open('src/data/books.ts', 'w', encoding='utf-8') as f:
    f.write(new_text)

print("Updated books.ts with Chapter 55.")
