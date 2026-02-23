#!/usr/bin/env python3
"""
gen_cet4_details.py
为 CET-4 1077 个单词生成结构化词源详情。

运行方式：
  python3 scripts/gen_cet4_details.py

输出：public/words/cet4.json
"""

import re, json, os

# ─── 1. 从 books.ts 提取单词列表 ───────────────────────────────────────────────
def extract_words_from_ts(ts_path: str):
    with open(ts_path, encoding="utf-8") as f:
        content = f.read()
    # 匹配 { id: N, word: 'xxx', phonetic: '...', meaning: '...' }
    pattern = r"\{\s*id:\s*(\d+),\s*word:\s*'([^']+)',\s*phonetic:\s*'([^']+)',\s*meaning:\s*'([^']+)'(?:,\s*example:\s*'([^']*)')?"
    result = []
    for m in re.finditer(pattern, content):
        result.append({
            "id": int(m.group(1)),
            "word": m.group(2),
            "phonetic": m.group(3),
            "meaning": m.group(4),
            "example": m.group(5) or "",
        })
    return result

# ─── 2. 词根词缀数据库 ──────────────────────────────────────────────────────────
PREFIXES = {
    "a": ("a-", "不；无；在…上", "Latin/Greek"),
    "ab": ("ab-", "离开；脱离", "Latin"),
    "ac": ("ac-", "朝向；加强", "Latin"),
    "ad": ("ad-", "朝向；添加", "Latin"),
    "al": ("al-", "朝向（ad-变体）", "Latin"),
    "an": ("an-", "不；无", "Greek"),
    "ante": ("ante-", "在…之前", "Latin"),
    "anti": ("anti-", "反对；对抗", "Greek"),
    "ap": ("ap-", "朝向（ad-变体）", "Latin"),
    "ar": ("ar-", "朝向（ad-变体）", "Latin"),
    "as": ("as-", "朝向（ad-变体）", "Latin"),
    "at": ("at-", "朝向（ad-变体）", "Latin"),
    "auto": ("auto-", "自动；自己", "Greek"),
    "be": ("be-", "使…；完全", "Old English"),
    "bi": ("bi-", "两；双", "Latin"),
    "bio": ("bio-", "生命；生物", "Greek"),
    "circum": ("circum-", "环绕；周围", "Latin"),
    "co": ("co-", "共同；一起", "Latin"),
    "col": ("col-", "共同（con-变体）", "Latin"),
    "com": ("com-", "共同；完全", "Latin"),
    "con": ("con-", "共同；一起；完全", "Latin"),
    "contra": ("contra-", "反对；相反", "Latin"),
    "cor": ("cor-", "共同（con-变体）", "Latin"),
    "counter": ("counter-", "反对；相反", "Latin"),
    "de": ("de-", "向下；去除；否定", "Latin"),
    "di": ("di-", "两；分开", "Latin/Greek"),
    "dia": ("dia-", "穿过；完全", "Greek"),
    "dis": ("dis-", "否定；分开；不", "Latin"),
    "e": ("e-", "出；向外（ex-变体）", "Latin"),
    "ef": ("ef-", "出；向外（ex-变体）", "Latin"),
    "em": ("em-", "使…进入；在内（en-变体）", "Latin/French"),
    "en": ("en-", "使…进入；在内", "Latin/French"),
    "ex": ("ex-", "出；向外；前…", "Latin"),
    "extra": ("extra-", "超出；在外", "Latin"),
    "fore": ("fore-", "在…之前；预先", "Old English"),
    "hyper": ("hyper-", "超出；过度", "Greek"),
    "hypo": ("hypo-", "在下；不足", "Greek"),
    "il": ("il-", "不；否定（in-变体）", "Latin"),
    "im": ("im-", "不；否定；进入", "Latin"),
    "in": ("in-", "不；否定；向内；进入", "Latin"),
    "inter": ("inter-", "在…之间；相互", "Latin"),
    "intra": ("intra-", "在…内部", "Latin"),
    "ir": ("ir-", "不；否定（in-变体）", "Latin"),
    "macro": ("macro-", "大；宏观", "Greek"),
    "mal": ("mal-", "坏；错误", "Latin"),
    "micro": ("micro-", "小；微观", "Greek"),
    "mid": ("mid-", "中间", "Old English"),
    "mis": ("mis-", "错误；不当", "Old English"),
    "mono": ("mono-", "单一；一个", "Greek"),
    "multi": ("multi-", "多；许多", "Latin"),
    "non": ("non-", "不；非；无", "Latin"),
    "ob": ("ob-", "朝向；反对", "Latin"),
    "of": ("of-", "朝向（ob-变体）", "Latin"),
    "op": ("op-", "朝向（ob-变体）", "Latin"),
    "out": ("out-", "超出；向外", "Old English"),
    "over": ("over-", "过度；在上", "Old English"),
    "per": ("per-", "贯穿；完全；每", "Latin"),
    "poly": ("poly-", "多；许多", "Greek"),
    "post": ("post-", "在…之后", "Latin"),
    "pre": ("pre-", "在…之前；预先", "Latin"),
    "pro": ("pro-", "向前；支持；代替", "Latin/Greek"),
    "re": ("re-", "再；重新；回", "Latin"),
    "retro": ("retro-", "向后；回", "Latin"),
    "se": ("se-", "分离；独自", "Latin"),
    "semi": ("semi-", "半；部分", "Latin"),
    "sub": ("sub-", "在下；次级；从属", "Latin"),
    "suf": ("suf-", "在下（sub-变体）", "Latin"),
    "sug": ("sug-", "在下（sub-变体）", "Latin"),
    "sup": ("sup-", "在下（sub-变体）", "Latin"),
    "sur": ("sur-", "在上；超越", "Latin/French"),
    "sus": ("sus-", "在下（sub-变体）", "Latin"),
    "sym": ("sym-", "共同；一起（syn-变体）", "Greek"),
    "syn": ("syn-", "共同；一起", "Greek"),
    "tele": ("tele-", "远；远程", "Greek"),
    "trans": ("trans-", "横越；转变；超越", "Latin"),
    "tri": ("tri-", "三", "Latin/Greek"),
    "un": ("un-", "不；否定；相反", "Old English"),
    "under": ("under-", "在下；不足", "Old English"),
    "uni": ("uni-", "一；单一", "Latin"),
    "up": ("up-", "向上", "Old English"),
    "with": ("with-", "对抗；相反", "Old English"),
}

SUFFIXES = {
    "able": ("-able", "能…的；可…的", "Latin"),
    "ible": ("-ible", "能…的；可…的", "Latin"),
    "acy": ("-acy", "状态；性质；行为", "Latin/Greek"),
    "age": ("-age", "行为；状态；集合", "Latin/French"),
    "al": ("-al", "…的；与…有关的", "Latin"),
    "ance": ("-ance", "状态；性质；行为", "Latin"),
    "ence": ("-ence", "状态；性质；行为", "Latin"),
    "ant": ("-ant", "…的人；具有…性质的", "Latin"),
    "ent": ("-ent", "…的人；具有…性质的", "Latin"),
    "ary": ("-ary", "与…有关的；…的人", "Latin"),
    "ate": ("-ate", "使…；具有…的", "Latin"),
    "ation": ("-ation", "行为；过程；结果", "Latin"),
    "tion": ("-tion", "行为；过程；结果", "Latin"),
    "sion": ("-sion", "行为；状态", "Latin"),
    "ism": ("-ism", "主义；行为；状态", "Greek"),
    "ist": ("-ist", "…者；…主义者", "Greek"),
    "ity": ("-ity", "性质；状态；程度", "Latin"),
    "ty": ("-ty", "性质；状态", "Latin"),
    "ive": ("-ive", "有…性质的；倾向于…的", "Latin"),
    "ize": ("-ize", "使…化；进行…", "Greek"),
    "ise": ("-ise", "使…化（英式拼法）", "Greek"),
    "fy": ("-fy", "使…；使成为", "Latin"),
    "ify": ("-ify", "使…；使成为", "Latin"),
    "less": ("-less", "无…的；缺乏…的", "Old English"),
    "ful": ("-ful", "充满…的；有…的", "Old English"),
    "ment": ("-ment", "行为；结果；状态", "Latin"),
    "ness": ("-ness", "性质；状态", "Old English"),
    "or": ("-or", "…者；做…的人或物", "Latin"),
    "er": ("-er", "…者；做…的人", "Old English"),
    "ous": ("-ous", "有…的；充满…的", "Latin"),
    "ious": ("-ious", "有…的；充满…的", "Latin"),
    "uous": ("-uous", "有…的；充满…的", "Latin"),
    "ure": ("-ure", "行为；结果；状态", "Latin"),
    "ward": ("-ward", "朝向…方向", "Old English"),
    "wise": ("-wise", "以…方式；关于…", "Old English"),
    "ly": ("-ly", "以…方式；具有…性质", "Old English"),
    "ary": ("-ary", "与…有关；…的场所", "Latin"),
    "ory": ("-ory", "与…有关的；…的场所", "Latin"),
    "ery": ("-ery", "…的行业；…的性质", "Latin/French"),
    "ic": ("-ic", "…的；与…有关的", "Greek/Latin"),
    "ical": ("-ical", "…的；与…有关的", "Greek/Latin"),
}

# ─── 3. 常见词根数据库 ──────────────────────────────────────────────────────────
ROOTS = {
    "abandon": ("abandon", "放弃", "Old French abandonner（放弃权利）← bandon（权力/管辖）← 日耳曼语"),
    "abil": ("abil/il", "能力", "Latin habilis（易于处理的）"),
    "abs": ("abs", "离开", "Latin absentia"),
    "solut": ("solut", "解开；释放", "Latin solvere（解开）"),
    "sorb": ("sorb", "吸收", "Latin absorbere"),
    "tract": ("tract/trah", "拉；拖", "Latin trahere"),
    "und": ("und", "波浪；丰富", "Latin unda（波浪）"),
    "adem": ("adem/academ", "学院", "Greek Akademia（雅典学园）"),
    "celer": ("celer", "快速", "Latin celer（快速的）"),
    "cent": ("cent/acent", "唱；呼喊", "Latin cantus（歌）"),
    "cept": ("cept/cap/ceiv", "拿；取", "Latin capere（拿取）"),
    "cess": ("cess/ced", "走；让步", "Latin cedere（走；让步）"),
    "cid": ("cid/cis", "切；杀", "Latin caedere（切割）"),
    "claim": ("claim/clam", "呼喊", "Latin clamare（呼喊）"),
    "clin": ("clin", "倾斜", "Latin clinare（倾斜）"),
    "clud": ("clud/clus", "关闭", "Latin claudere（关闭）"),
    "cord": ("cord", "心；一致", "Latin cor/cordis（心脏）"),
    "corpor": ("corpor", "身体", "Latin corpus（身体）"),
    "cred": ("cred", "相信；信任", "Latin credere（相信）"),
    "cur": ("cur/cours", "跑；流", "Latin currere（跑）"),
    "dict": ("dict/dic", "说；指示", "Latin dicere（说）"),
    "duc": ("duc/duct", "引导；带领", "Latin ducere（引导）"),
    "equ": ("equ", "相等；平衡", "Latin aequus（相等的）"),
    "fac": ("fac/fect/fic", "做；制造", "Latin facere（做）"),
    "fer": ("fer", "带；携带", "Latin ferre（带来）"),
    "fid": ("fid/fis", "信任；忠诚", "Latin fidere（信任）"),
    "fin": ("fin", "结束；界限", "Latin finis（终点）"),
    "firm": ("firm", "坚固", "Latin firmus（坚固的）"),
    "flex": ("flex/flect", "弯曲", "Latin flectere（弯曲）"),
    "flu": ("flu/flux", "流动", "Latin fluere（流动）"),
    "form": ("form", "形式；形状", "Latin forma（形状）"),
    "fort": ("fort", "强壮；力量", "Latin fortis（强壮的）"),
    "frag": ("frag/fract", "打破", "Latin frangere（破碎）"),
    "fund": ("fund/found", "基础；底部", "Latin fundus（底部）"),
    "gen": ("gen", "产生；出生；种类", "Greek/Latin genus（种族）"),
    "grad": ("grad/gress", "步骤；走", "Latin gradi（行走）"),
    "gram": ("gram/graph", "写；画", "Greek graphein（写）"),
    "grat": ("grat", "感谢；令人愉快", "Latin gratus（令人满意的）"),
    "greg": ("greg", "群体", "Latin grex/gregis（羊群）"),
    "habit": ("habit/hibit", "持有；居住", "Latin habere（持有）"),
    "her": ("her/hes", "粘附", "Latin haerere（粘附）"),
    "it": ("it/it", "走", "Latin ire（走）"),
    "ject": ("ject", "投；抛", "Latin jacere（投掷）"),
    "jug": ("jug/junct", "连接", "Latin jungere（连接）"),
    "leg": ("leg/lig/lect", "读；收集；选择", "Latin legere（读；选择）"),
    "liber": ("liber", "自由", "Latin liber（自由的）"),
    "liter": ("liter", "文字；字母", "Latin littera（字母）"),
    "loc": ("loc", "地方", "Latin locus（地方）"),
    "log": ("log", "词；说；逻辑", "Greek logos（词；理性）"),
    "luc": ("luc/lumin", "光", "Latin lux/lucis（光）"),
    "man": ("man/manu", "手", "Latin manus（手）"),
    "ment": ("ment", "心智", "Latin mens/mentis（心智）"),
    "migr": ("migr", "迁移", "Latin migrare（迁移）"),
    "mit": ("mit/miss", "发送", "Latin mittere（发送）"),
    "mob": ("mob/mot/mov", "移动", "Latin movere（移动）"),
    "mod": ("mod", "方式；节制", "Latin modus（方式）"),
    "mor": ("mor/mort", "死亡", "Latin mors/mortis（死亡）"),
    "nat": ("nat/nasc", "出生", "Latin nasci（出生）"),
    "nomin": ("nomin/nom", "名称", "Latin nomen（名称）"),
    "norm": ("norm", "规则；标准", "Latin norma（规则）"),
    "not": ("not", "注意；标记", "Latin notare（标记）"),
    "nov": ("nov", "新", "Latin novus（新的）"),
    "oper": ("oper", "工作", "Latin opus/operis（工作）"),
    "opt": ("opt", "选择", "Latin optare（选择）"),
    "ord": ("ord/ordin", "顺序", "Latin ordo（顺序）"),
    "orig": ("orig", "起源", "Latin oriri（升起）"),
    "par": ("par", "相等；准备", "Latin parare（准备）"),
    "path": ("path", "感情；疾病", "Greek pathos（感情）"),
    "pend": ("pend/pens", "悬挂；支付", "Latin pendere（悬挂）"),
    "pet": ("pet/pit", "追求；飞", "Latin petere（追求）"),
    "plic": ("plic/plex/ply", "折叠；复杂", "Latin plicare（折叠）"),
    "port": ("port", "携带；港口", "Latin portare（携带）"),
    "pos": ("pos/pon", "放置", "Latin ponere（放置）"),
    "press": ("press", "压", "Latin pressare（压）"),
    "prim": ("prim", "第一；首要", "Latin primus（第一的）"),
    "priv": ("priv", "私有；剥夺", "Latin privus（各自的）"),
    "prob": ("prob/prov", "证明；好", "Latin probare（证明）"),
    "quer": ("quer/quest", "寻求；问", "Latin quaerere（寻求）"),
    "rect": ("rect", "直；正确", "Latin rectus（直的）"),
    "reg": ("reg/rig", "管理；规则", "Latin regere（统治）"),
    "rupt": ("rupt", "破裂", "Latin rumpere（打破）"),
    "scrib": ("scrib/script", "写", "Latin scribere（写）"),
    "sens": ("sens/sent", "感觉", "Latin sentire（感觉）"),
    "sequ": ("sequ/secut", "跟随", "Latin sequi（跟随）"),
    "serv": ("serv", "保持；服务", "Latin servare（保持）"),
    "sign": ("sign", "记号；符号", "Latin signum（符号）"),
    "simil": ("simil/simul", "相似", "Latin similis（相似的）"),
    "sist": ("sist/stat/st", "站立", "Latin stare（站立）"),
    "solv": ("solv/solut", "溶解；解决", "Latin solvere（解开）"),
    "son": ("son", "声音", "Latin sonus（声音）"),
    "spec": ("spec/spect", "看", "Latin specere（看）"),
    "spher": ("spher", "球体", "Greek sphaira（球体）"),
    "spir": ("spir", "呼吸；精神", "Latin spirare（呼吸）"),
    "struct": ("struct", "建造；建筑", "Latin struere（建造）"),
    "sum": ("sum/sumpt", "拿取", "Latin sumere（拿取）"),
    "tang": ("tang/tact", "接触", "Latin tangere（触碰）"),
    "tele": ("tele", "远", "Greek tele（远）"),
    "tempor": ("tempor", "时间；季节", "Latin tempus（时间）"),
    "tend": ("tend/tens", "伸展；趋向", "Latin tendere（伸展）"),
    "termin": ("termin", "边界；终点", "Latin terminus（边界）"),
    "test": ("test", "见证；证明", "Latin testis（见证人）"),
    "text": ("text", "编织；文本", "Latin texere（编织）"),
    "tor": ("tor/tort", "扭；转", "Latin torquere（扭转）"),
    "trib": ("trib", "给予；部落", "Latin tribuere（给予）"),
    "turb": ("turb", "扰动", "Latin turbare（扰动）"),
    "urb": ("urb", "城市", "Latin urbs（城市）"),
    "vac": ("vac", "空的", "Latin vacuus（空的）"),
    "val": ("val", "价值；力量", "Latin valere（有力；有价值）"),
    "var": ("var", "变化", "Latin varius（各种各样的）"),
    "vene": ("ven/vent", "来；到来", "Latin venire（来）"),
    "ver": ("ver", "真实", "Latin verus（真实的）"),
    "verb": ("verb", "词；动词", "Latin verbum（词）"),
    "vert": ("vert/vers", "转变；转向", "Latin vertere（转动）"),
    "vid": ("vid/vis", "看见", "Latin videre（看见）"),
    "vit": ("vit/viv", "生命", "Latin vita/vivere（生命）"),
    "voc": ("voc/vok", "声音；呼唤", "Latin vocare（呼唤）"),
    "vol": ("vol/volv", "意志；卷绕", "Latin velle（愿意）"),
}

# ─── 4. 手工精选：1077词中重要词的完整词源 ─────────────────────────────────────
MANUAL_DATA = {
    "abandon": dict(prefix="a-(朝向)", root="bandon(权力/管辖)", suffix="",
        etymology="来自古法语 abandonner，a(朝向)+bandon(权力)，原意置于他人权力之下，后演变为放弃",
        wordFormation="a-(方向) + bandon(管辖权) → 置于他人权力之下 → 放弃",
        cognates=["bandon", "contraband"]),
    "ability": dict(prefix="", root="habil(能力)", suffix="-ity(性质/状态)",
        etymology="来自拉丁语 habilitas，源于 habilis(适于处理的)，由 habere(持有)派生",
        wordFormation="habil(能力) + -ity(名词后缀) → 能力",
        cognates=["able", "capable", "habilitate"]),
    "absence": dict(prefix="ab-(离开)", root="esse(存在)", suffix="-ence(状态)",
        etymology="来自拉丁语 absentia，ab-(离开)+esse(存在)，意为不在场",
        wordFormation="ab-(离开) + esse(存在) + -ence(名词后缀) → 缺席状态",
        cognates=["absent", "presence", "essence"]),
    "absolute": dict(prefix="ab-(离开)", root="solut(释放)", suffix="-e(形容词)",
        etymology="来自拉丁语 absolutus(完整的、自由的)，ab-(离开)+solvere(解开)的过去分词",
        wordFormation="ab-(完全) + solut(解开/释放) → 完全解放的 → 绝对的",
        cognates=["solve", "solution", "resolve", "absolve"]),
    "absorb": dict(prefix="ab-(朝向)", root="sorb(吸入)", suffix="",
        etymology="来自拉丁语 absorbere，ab-(朝向)+sorbere(吸入)，意为完全吸收",
        wordFormation="ab-(完全) + sorb(吸入) → 吸收",
        cognates=["sorbet", "absorption"]),
    "abstract": dict(prefix="ab-(离开)", root="tract(拉)", suffix="",
        etymology="来自拉丁语 abstractus，ab-(离开)+trahere(拉)，意为从具体中抽离出来",
        wordFormation="ab-(离开) + tract(拉/拖) → 从具体中抽离 → 抽象",
        cognates=["attract", "contract", "tractor", "extract"]),
    "abundant": dict(prefix="ab-(加强)", root="und(波浪)", suffix="-ant(形容词)",
        etymology="来自拉丁语 abundans，ab-(加强)+unda(波浪)，原意像波浪般涌现",
        wordFormation="ab-(加强) + und(涌流) + -ant(形容词) → 大量涌现的 → 丰富",
        cognates=["abound", "abundance", "inundate", "redundant"]),
    "achieve": dict(prefix="a-(朝向)", root="chief(头；首领)", suffix="",
        etymology="来自古法语 achever，由 a(朝向)+chef(头)构成，原意到达顶点/完成",
        wordFormation="a-(朝向) + chieve(头/终点) → 到达终点 → 实现",
        cognates=["chief", "chapter", "achievement"]),
    "acknowledge": dict(prefix="ac-(加强)", root="knowl(知道)", suffix="-edge(名词→动词)",
        etymology="ac-(加强)+knowledge(知识)，源自古英语，意为承认已知的事实",
        wordFormation="ac-(加强) + knowledge(知识) → 正式承认",
        cognates=["know", "knowledge", "unknown"]),
    "acquire": dict(prefix="ac-(朝向)", root="quire(寻求)", suffix="",
        etymology="来自拉丁语 acquirere，ac-(朝向)+quaerere(寻求)，意为追求并得到",
        wordFormation="ac-(朝向) + quire(寻求) → 寻求并获得 → 获取",
        cognates=["query", "require", "inquire", "quest"]),
    "adapt": dict(prefix="ad-(朝向)", root="apt(适合)", suffix="",
        etymology="来自拉丁语 adaptare，ad-(朝向)+aptare(使适合)，意为使合适",
        wordFormation="ad-(朝向) + apt(适合) → 使适合 → 适应",
        cognates=["apt", "aptitude", "unapt", "adaptive"]),
    "adequate": dict(prefix="ad-(朝向)", root="equ(相等)", suffix="-ate(形容词)",
        etymology="来自拉丁语 adaequatus，ad-(朝向)+aequus(平等的)，意为达到相等标准",
        wordFormation="ad-(朝向) + equ(平等) + -ate → 足够到达标准的",
        cognates=["equal", "equate", "equation", "equip"]),
    "adjust": dict(prefix="ad-(朝向)", root="just(正确)", suffix="",
        etymology="来自古法语 ajuster，ad-(朝向)+justus(正确的)，意为使正确",
        wordFormation="ad-(朝向) + just(正确/公正) → 校正 → 调整",
        cognates=["just", "justice", "justify", "readjust"]),
    "benefit": dict(prefix="bene-(好)", root="fit/fac(做)", suffix="",
        etymology="来自拉丁语 benefactum，bene(好)+facere(做)，意为做好事/福利",
        wordFormation="bene-(好) + fit(做) → 做好事 → 好处/利益",
        cognates=["beneficial", "benefactor", "benevolence", "bonus"]),
    "challenge": dict(prefix="", root="calumni(诽谤；指控)", suffix="",
        etymology="来自古法语 chalenge，源于拉丁语 calumnia(诽谤)，原指法律上的质疑，后演变为挑战",
        wordFormation="源自拉丁 calumnia(质疑/指控) → 古法语 chalenge → 挑战",
        cognates=["calumny"]),
    "communicate": dict(prefix="com-(共同)", root="munic(服务；礼物)", suffix="-ate(动词)",
        etymology="来自拉丁语 communicare，com-(共同)+munus(礼物/职责)，意为共享",
        wordFormation="com-(共同) + munic(分享) + -ate → 共同分享 → 沟通",
        cognates=["community", "immune", "commune", "common"]),
    "complex": dict(prefix="com-(完全)", root="plex(折叠)", suffix="",
        etymology="来自拉丁语 complexus，com-(完全)+plectere(编织)，意为相互缠绕的",
        wordFormation="com-(共同) + plex(折叠/编织) → 交织在一起 → 复杂",
        cognates=["perplex", "duplex", "multiply", "implicit"]),
    "contribute": dict(prefix="con-(共同)", root="trib(给予)", suffix="-ute(动词)",
        etymology="来自拉丁语 contribuere，con-(共同)+tribuere(给予)，意为共同给予",
        wordFormation="con-(共同) + trib(给予) + -ute → 共同给予 → 贡献",
        cognates=["tribute", "distribute", "attribute", "retribute"]),
    "develop": dict(prefix="de-(否定)", root="velop(包裹)", suffix="",
        etymology="来自法语 developper，de-(解开)+veloper(包裹)，原意从包裹中展开，引申为发展",
        wordFormation="de-(解开) + velop(包裹) → 展开包裹 → 开发/发展",
        cognates=["envelope", "envelop"]),
    "economy": dict(prefix="", root="eco/oiko(家)+nom(管理)", suffix="-y(名词)",
        etymology="来自希腊语 oikonomia，oikos(家)+nomos(管理)，原为家庭管理，扩展为经济学",
        wordFormation="eco(家) + nom(管理) + -y → 家庭管理 → 经济",
        cognates=["ecology", "astronomy", "autonomy"]),
    "environment": dict(prefix="en-(在内)", root="viron(环绕)", suffix="-ment(名词)",
        etymology="来自古法语 environner(环绕)，en-(在内)+viron(环绕)，意为周围的环境",
        wordFormation="en-(在内) + viron(环绕) + -ment → 环绕之物 → 环境",
        cognates=["environ", "environs"]),
    "establish": dict(prefix="e-(向外)", root="stabil(稳固)", suffix="-ish(动词)",
        etymology="来自拉丁语 stabilire(使稳固)，通过古法语进入英语，意为使稳固建立",
        wordFormation="e-(加强) + stabil(稳固) + -ish → 使稳固建立",
        cognates=["stable", "stability", "stabilize"]),
    "evidence": dict(prefix="e-(向外)", root="vid(看)", suffix="-ence(名词)",
        etymology="来自拉丁语 evidentia，e-(向外)+videre(看见)，意为可见的证据",
        wordFormation="e-(向外) + vid(看) + -ence → 可以看到的 → 证据",
        cognates=["video", "vision", "evident", "provide"]),
    "generate": dict(prefix="", root="gen(产生；种类)", suffix="-ate(动词)",
        etymology="来自拉丁语 generare，genus(种类/出生)，意为使产生",
        wordFormation="gen(产生) + -er + -ate → 使产生 → 生成",
        cognates=["general", "gene", "generation", "gender", "genuine"]),
    "identify": dict(prefix="", root="ident(同一)", suffix="-ify(使…)",
        etymology="来自拉丁语 identitas，idem(相同的)+-ify(使)，意为确认为同一个",
        wordFormation="ident(相同) + -ify(使) → 确认同一 → 识别",
        cognates=["identical", "identity", "identification"]),
    "implement": dict(prefix="im-(进入)", root="ple(填满)", suffix="-ment(名词→动词)",
        etymology="来自拉丁语 implementum(填充物)，im-(进入)+plere(填满)，后引申为工具/实施",
        wordFormation="im-(进入) + ple(填满) + -ment → 填满→完成→实施",
        cognates=["complete", "deplete", "supplement", "complement"]),
    "indicate": dict(prefix="in-(朝向)", root="dic(说；指)", suffix="-ate(动词)",
        etymology="来自拉丁语 indicare，in-(朝向)+dicare(宣示)，意为指向某事",
        wordFormation="in-(朝向) + dic(说/指) + -ate → 指向说明 → 表示",
        cognates=["dictate", "predict", "dedicate"]),
    "influence": dict(prefix="in-(进入)", root="flu(流)", suffix="-ence(名词)",
        etymology="来自中世纪拉丁语 influentia，in-(进入)+fluere(流)，原为星相学术语，星体流出力量影响地球",
        wordFormation="in-(向内) + flu(流) + -ence → 流入 → 影响",
        cognates=["fluid", "fluent", "flow", "influx", "affluent"]),
    "integrate": dict(prefix="in-(进入)", root="teg(接触；整体)", suffix="-ate(动词)",
        etymology="来自拉丁语 integrare，integer(完整的)+-ate，意为使成为整体",
        wordFormation="in-(完全) + teg(整体) + -ate → 使完整 → 整合",
        cognates=["integer", "integrity", "integral", "disintegrate"]),
    "maintain": dict(prefix="main-(手)", root="tain(持有)", suffix="",
        etymology="来自古法语 maintenir，manu(手)+tenere(持有)，原意用手持有",
        wordFormation="main(手) + tain(持有) → 用手保持 → 维持",
        cognates=["retain", "contain", "obtain", "sustain", "tenant"]),
    "participate": dict(prefix="parti-(部分)", root="cip(拿；获取)", suffix="-ate(动词)",
        etymology="来自拉丁语 participare，pars(部分)+capere(拿取)，意为取得一份",
        wordFormation="parti(部分) + cip(拿) + -ate → 取得一份 → 参与",
        cognates=["part", "capture", "anticipate", "principle"]),
    "perform": dict(prefix="per-(完全)", root="form(形式)", suffix="",
        etymology="来自古法语 parfournir，per-(完全)+fornir(提供/完成)，意为完整执行",
        wordFormation="per-(完全) + form(形式) → 完整展现 → 表演/执行",
        cognates=["form", "reform", "transform", "performance"]),
    "potential": dict(prefix="", root="potent(有力量的)", suffix="-ial(形容词)",
        etymology="来自拉丁语 potentialis，potens(有能力的)，源于posse(能够)，意为有可能的",
        wordFormation="potent(力量) + -ial → 有力量可能的 → 潜在的",
        cognates=["potent", "power", "possible", "impotent"]),
    "principle": dict(prefix="princi-(第一)", root="pl(拿；取)", suffix="-e",
        etymology="来自拉丁语 principium，princeps(第一个人/首领)，primus(第一)+capere(拿取)",
        wordFormation="princi(第一) + pl(取) + -e → 首要之物 → 原则",
        cognates=["prince", "principal", "primary", "capture"]),
    "process": dict(prefix="pro-(向前)", root="cess(走)", suffix="",
        etymology="来自拉丁语 processus，pro-(向前)+cedere(走)，意为向前行进",
        wordFormation="pro-(向前) + cess(走) → 向前推进 → 过程",
        cognates=["exceed", "proceed", "succeed", "recede", "access"]),
    "recognize": dict(prefix="re-(再次)", root="cogn(知道)", suffix="-ize(动词)",
        etymology="来自拉丁语 recognoscere，re-(再次)+cognoscere(知道)，意为再次知晓",
        wordFormation="re-(再) + cogn(知道) + -ize → 再次了解 → 认出",
        cognates=["cognition", "diagnose", "incognito"]),
    "significant": dict(prefix="", root="sign(标记、符号)", suffix="-ificant(形容词)",
        etymology="来自拉丁语 significans，signum(符号)+facere(做)，意为具有符号意义的",
        wordFormation="sign(符号) + -ific(做) + -ant → 有意义的 → 重要的",
        cognates=["sign", "signal", "signify", "assign", "design"]),
    "strategy": dict(prefix="", root="strat(军队)+ag(领导)", suffix="-y(名词)",
        etymology="来自希腊语 strategia，strategos(将军)，stratos(军队)+agein(引导)",
        wordFormation="strat(军队) + ag(领导) + -y → 军队统领之术 → 策略",
        cognates=["strategic", "stratagem", "stratosphere"]),
    "structure": dict(prefix="", root="struct(建造)", suffix="-ure(名词)",
        etymology="来自拉丁语 structura，struere(建造、堆积)的名词形式",
        wordFormation="struct(建造) + -ure → 建造出来的东西 → 结构",
        cognates=["construct", "instruct", "destroy", "obstruct"]),
    "transform": dict(prefix="trans-(横越)", root="form(形式)", suffix="",
        etymology="来自拉丁语 transformare，trans-(横越)+forma(形状)，意为改变形状",
        wordFormation="trans-(跨越) + form(形状) → 跨越形状 → 变形/变革",
        cognates=["form", "reform", "perform", "formation"]),
    "volunteer": dict(prefix="", root="voluntar(意志)", suffix="-eer(名词)",
        etymology="来自拉丁语 voluntarius，voluntas(意志)，velle(愿意)+-arius",
        wordFormation="volunt(意志) + -eer → 出于自愿的人 → 志愿者",
        cognates=["voluntary", "volition", "benevolent", "malevolent"]),
}

# ─── 5. 智能推断词源（用于无手工数据的词）──────────────────────────────────────
def infer_etymology(word: str) -> dict:
    """基于词根词缀数据库推断词源"""
    result = {"prefix": "", "root": "", "suffix": "", "etymology": "", "wordFormation": "", "cognates": []}

    # 检测前缀（从长到短）
    found_prefix = None
    prefix_form = ""
    for p_key in sorted(PREFIXES.keys(), key=len, reverse=True):
        if word.lower().startswith(p_key) and len(word) > len(p_key) + 2:
            found_prefix = PREFIXES[p_key]
            prefix_form = p_key
            break

    # 检测后缀（从长到短）
    found_suffix = None
    suffix_form = ""
    for s_key in sorted(SUFFIXES.keys(), key=len, reverse=True):
        if word.lower().endswith(s_key) and len(word) > len(s_key) + 2:
            found_suffix = SUFFIXES[s_key]
            suffix_form = s_key
            break

    if found_prefix:
        result["prefix"] = f"{found_prefix[0]}（{found_prefix[1]}）"
    if found_suffix:
        result["suffix"] = f"{found_suffix[0]}（{found_suffix[1]}）"

    # 猜测词根词源语言
    lang_hint = ""
    if found_prefix:
        lang_hint = found_prefix[2]
    elif found_suffix:
        lang_hint = found_suffix[2]

    if lang_hint:
        result["etymology"] = f"源自{lang_hint}，由词根 {word} 演变而来"
    else:
        result["etymology"] = f"源自古英语或拉丁语传统词汇"

    # 构词法说明
    parts = []
    if found_prefix:
        parts.append(f"{found_prefix[0]}（{found_prefix[1]}）")
    stem = word
    if found_prefix:
        stem = word[len(prefix_form):]
    if found_suffix:
        stem = stem[:-len(suffix_form)] if len(stem) > len(suffix_form) else stem
    if stem and stem != word:
        parts.append(f"-{stem}-（词干）")
    if found_suffix:
        parts.append(f"{found_suffix[0]}（{found_suffix[1]}）")

    if len(parts) >= 2:
        result["wordFormation"] = " + ".join(parts)

    return result

# ─── 6. 主流程 ──────────────────────────────────────────────────────────────────
def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(script_dir)
    ts_path = os.path.join(root_dir, "src", "data", "books.ts")
    out_path = os.path.join(root_dir, "public", "words", "cet4.json")

    print("📖 读取 books.ts 中的单词...")
    words = extract_words_from_ts(ts_path)
    print(f"   找到 {len(words)} 个单词")

    print("🔬 读取 etymology_data_sample.jsonl...")
    jsonl_data = {}
    jsonl_path = os.path.join(root_dir, "public", "etymology_data_sample.jsonl")
    with open(jsonl_path, encoding="utf-8") as f:
        for line in f:
            try:
                obj = json.loads(line.strip())
                jsonl_data[obj["word"].lower()] = obj
            except Exception:
                pass
    print(f"   词源库共 {len(jsonl_data)} 条")

    print("⚙️  生成词语详情...")
    details = []
    manual_count = 0
    jsonl_count = 0
    infer_count = 0

    for w in words:
        word_lower = w["word"].lower()
        detail = {
            "bookId": "cet4",
            "wordId": w["id"],
            "word": w["word"],
        }

        # 优先级 1：手工精选数据（最高质量）
        if word_lower in MANUAL_DATA:
            detail.update(MANUAL_DATA[word_lower])
            if detail.get("etymology") and not detail["etymology"].startswith("源自"):
                pass  # 已有高质量词源
            manual_count += 1

        # 优先级 2：从 jsonl 提取 etymology_summary
        elif word_lower in jsonl_data:
            jd = jsonl_data[word_lower]
            inferred = infer_etymology(w["word"])
            detail.update(inferred)
            # 用 jsonl 的摘要增强 etymology 字段（截取前 150 字）
            summary = jd.get("etymology_summary", "")
            if summary:
                detail["etymology"] = summary[:200] + ("..." if len(summary) > 200 else "")
            cognates = jd.get("etymology_cognates", [])
            if cognates:
                detail["cognates"] = [c.lower() for c in cognates[:6]]
            jsonl_count += 1

        # 优先级 3：基于词根词缀自动推断
        else:
            inferred = infer_etymology(w["word"])
            detail.update(inferred)
            infer_count += 1

        details.append(detail)

    out_data = {
        "_version": "1.0",
        "_generated": "2026-02-21",
        "_description": "CET-4 词汇详情数据，包含词根词缀和词源信息",
        "words": details
    }

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out_data, f, ensure_ascii=False, indent=2)

    print(f"\n✅ 生成完成！")
    print(f"   手工精选: {manual_count} 词")
    print(f"   JSONL 辅助: {jsonl_count} 词")
    print(f"   自动推断: {infer_count} 词")
    print(f"   总计: {len(details)} 词")
    print(f"   输出: {out_path}")
    print(f"   文件大小: {os.path.getsize(out_path) / 1024:.1f} KB")

if __name__ == "__main__":
    main()
