import type { Language } from './i18n-core';
import { BLOG_POSTS, type BlogPost } from './blog';

type BlogTranslation = Pick<BlogPost, 'title' | 'excerpt' | 'sections'>;

type BlogTranslations = Partial<Record<Language, Readonly<Record<string, BlogTranslation>>>>;

/**
 * Editorial copy is kept separate from UI messages because it is long-form
 * content, but every published post has a complete French and Arabic edition.
 * Stable slugs and dates remain in `blog.ts`, so inbound links and the English
 * SEO canonical data do not change when the visitor changes their interface.
 */
const BLOG_TRANSLATIONS: BlogTranslations = {
  fr: {
    'what-its-for-vs-where-it-is': {
      title: "Pourquoi « à quoi sert l’argent » et « où il se trouve » sont deux questions différentes",
      excerpt:
        "La plupart des frustrations liées au budget viennent d’une confusion entre deux choses qui doivent rester distinctes : ce que votre argent doit couvrir et l’endroit où il se trouve réellement.",
      sections: [
        {
          heading: 'Un budget et un solde ne répondent pas à la même question',
          paragraphs: [
            "Un budget décrit votre intention. Il attribue un rôle à vos revenus : loyer, courses, loisirs ou épargne. Un solde décrit un emplacement : le montant détenu à cet instant sur un compte bancaire, à la maison ou dans un portefeuille.",
            "Ces deux vues sont liées, mais elles ne sont pas interchangeables. L’argent réservé aux courses peut être réparti entre votre banque et votre portefeuille. Votre solde bancaire peut contenir en même temps de l’argent prévu pour le loyer, l’épargne et plusieurs autres catégories.",
          ],
        },
        {
          heading: 'La première question : à quoi sert cet argent ?',
          paragraphs: [
            "C’est le côté planification du budget. SmartJib répartit un plan entre besoins, envies et épargne. Les catégories rendent ces grandes enveloppes utiles : le loyer et les courses essentielles peuvent relever des besoins, tandis que les sorties ou les loisirs peuvent relever des envies.",
            "La réponse doit garder son sens même si vous transférez de l’argent de la banque vers votre portefeuille. Un transfert change l’endroit où l’argent est détenu, mais il ne transforme pas le budget courses en budget loisirs et ne change pas l’objectif de votre épargne.",
          ],
          bullets: [
            'Les besoins couvrent les engagements essentiels et les nécessités du quotidien.',
            'Les envies couvrent les dépenses facultatives que vous pouvez généralement ajuster.',
            'L’épargne couvre l’argent mis de côté pour des objectifs ou un usage futur.',
          ],
        },
        {
          heading: 'La deuxième question : où se trouve l’argent ?',
          paragraphs: [
            "L’emplacement est une question de comptabilité. Si vous retirez 300 de votre banque pour les mettre dans votre portefeuille, le total de votre argent ne change pas. Le solde bancaire baisse de 300 et le solde du portefeuille augmente de 300.",
            "Enregistrer l’emplacement compte au moment de payer. Un achat en espèces doit diminuer le portefeuille, tandis qu’un achat par carte doit diminuer la banque. Chaque emplacement devient alors un vrai solde plutôt qu’une simple note approximative.",
          ],
        },
        {
          heading: 'Ce qui se passe quand les deux vues sont mélangées',
          paragraphs: [
            "Supposons que votre plan réserve 2 000 aux besoins, mais que vous déteniez 1 500 à la banque et 500 dans votre portefeuille. Considérer la banque comme une catégorie budgétaire donne l’impression que seul l’argent de la banque peut payer les besoins. Considérer les besoins comme un compte empêche de savoir s’il y a réellement assez d’espèces dans le portefeuille.",
            "La confusion devient plus nette après des transferts, des dépenses en espèces ou le financement d’un objectif d’épargne. Une action peut modifier un emplacement sans modifier le plan, alors qu’une autre peut utiliser une catégorie budgétaire et réduire un emplacement en même temps.",
          ],
          callout:
            "Règle utile : les catégories expliquent le but ; les emplacements d’argent expliquent le lieu. Un transfert change le lieu, tandis qu’une dépense change à la fois un emplacement et le montant dépensé dans le plan.",
        },
        {
          heading: 'Une routine mensuelle pratique',
          paragraphs: [
            "Commencez par répartir vos revenus entre besoins, envies et épargne. Enregistrez ensuite les montants de départ détenus à chaque emplacement. Pendant le mois, choisissez à la fois une catégorie et un lieu de paiement pour chaque dépense. Enregistrez les transferts séparément afin qu’ils n’apparaissent pas comme des dépenses.",
            "Examinez les deux vues pour des raisons différentes. Utilisez l’avancement des catégories pour vérifier que vos dépenses suivent toujours le plan. Utilisez les soldes des emplacements pour savoir si la banque, la maison ou le portefeuille disposent d’assez d’argent pour le prochain paiement.",
          ],
          bullets: [
            'Planifiez vos revenus par objectif au début du mois.',
            'Suivez la banque, la maison et le portefeuille comme des soldes distincts.',
            'Enregistrez les transferts sans les compter comme revenus ni comme dépenses.',
            'Pour chaque dépense, indiquez son but et l’endroit depuis lequel elle a été payée.',
          ],
        },
        {
          heading: 'La clarté vient des deux vues réunies',
          paragraphs: [
            "Un budget par catégories uniquement peut montrer que vous avez trop dépensé au restaurant, sans dire si l’argent manquant venait du portefeuille ou de la banque. Un suivi par soldes uniquement peut montrer ce qui se trouve à chaque endroit, sans dire si cet argent est réservé au loyer de la semaine prochaine.",
            "Séparer le but et l’emplacement apporte les deux réponses sans forcer un même ensemble d’étiquettes à faire deux métiers. Cette distinction est à la base des enveloppes besoins, envies et épargne de SmartJib ainsi que de ses emplacements banque, maison et portefeuille.",
          ],
        },
      ],
    },
    'pick-a-budgeting-style': {
      title: 'Choisir une méthode budgétaire qui vous correspond vraiment',
      excerpt:
        "La règle 50/30/20 ne convient pas à tout le monde. Voici comment choisir une répartition entre besoins, envies et épargne qui corresponde à votre vie réelle.",
      sections: [
        {
          heading: 'Une méthode budgétaire est une structure de départ',
          paragraphs: [
            "Une méthode budgétaire attribue par défaut un rôle à chaque part de votre revenu. Elle peut réduire le nombre de décisions à prendre chaque mois, mais elle ne peut pas connaître votre loyer, vos responsabilités familiales, vos revenus irréguliers ou votre objectif d’épargne actuel.",
            "La question utile n’est pas de savoir quelle méthode est universellement la meilleure. C’est de savoir quelle structure de départ ressemble le plus à vos obligations réelles et à l’habitude que vous souhaitez construire ensuite.",
          ],
        },
        {
          heading: 'Commencez par vos besoins non négociables',
          paragraphs: [
            "Listez le logement, les services essentiels, l’alimentation, les transports, les frais de santé et les remboursements minimums de dettes. Comparez leur total mensuel à votre revenu net. Vous obtenez ainsi un pourcentage des besoins fondé sur la réalité plutôt que sur une règle générale.",
            "Si les coûts essentiels utilisent déjà plus de la moitié de vos revenus, les forcer sous une limite de 50 % ne fera pas disparaître les factures. Choisissez une structure qui laisse davantage de place aux besoins, puis cherchez les changements réellement possibles avec le temps.",
          ],
          callout:
            "Utilisez les pourcentages comme des guides de planification, pas comme un verdict. Un budget réaliste que vous pouvez suivre est plus utile qu’une répartition idéale qui échoue chaque mois.",
        },
        {
          heading: 'Les quatre stratégies disponibles dans SmartJib',
          paragraphs: [
            "SmartJib propose quatre stratégies. Chacune répartit les revenus entre besoins, envies et épargne, tout en vous laissant modifier les plafonds de catégorie selon votre mois.",
          ],
          bullets: [
            "La règle 50/30/20 consacre 50 % aux besoins, 30 % aux envies et 20 % à l’épargne. C’est un point de départ équilibré lorsque les essentiels représentent environ la moitié du revenu.",
            "Le budget base zéro commence dans SmartJib par 60 % pour les besoins, 25 % pour les envies et 15 % pour l’épargne. Son principe est de donner un rôle explicite à tout le revenu au lieu de laisser de l’argent sans plan.",
            "Le budget par enveloppes commence par 55 % pour les besoins, 35 % pour les envies et 10 % pour l’épargne. Il convient aux personnes qui veulent des limites de catégorie visibles et des vérifications fréquentes des dépenses.",
            "Se payer d’abord utilise 45 % pour les besoins, 25 % pour les envies et 30 % pour l’épargne. Cette méthode réserve une part plus importante à l’épargne avant les dépenses facultatives.",
          ],
        },
        {
          heading: 'Choisissez selon le problème que vous voulez résoudre',
          paragraphs: [
            "Si vous avez surtout besoin d’une base simple, commencez par 50/30/20. Si de l’argent reste régulièrement sans attribution puis disparaît, le budget base zéro lui donne un rôle. Si une ou deux catégories dépassent sans cesse leur plafond, le budget par enveloppes rend ces limites plus visibles.",
            "Se payer d’abord peut aider lorsque l’épargne est toujours remise à la fin du mois. Cette méthode fonctionne mieux lorsque sa part d’épargne plus élevée laisse encore assez pour les engagements essentiels.",
          ],
        },
        {
          heading: 'Testez la méthode sur un vrai mois',
          paragraphs: [
            "Avant de vous engager, appliquez la répartition au revenu net du mois dernier. Comparez les montants obtenus avec ce que vous avez réellement dépensé en besoins, envies et épargne. Un mois inhabituel ne doit pas tout décider : répétez la comparaison sur deux ou trois mois si vous avez les données.",
            "Observez l’ampleur et le sens de l’écart. Une petite différence peut être traitée en ajustant les plafonds de catégorie. Un écart important et répété signifie généralement que cette stratégie n’est pas encore le bon point de départ.",
          ],
          bullets: [
            'La part des besoins peut-elle couvrir les factures essentielles sans prétendre qu’elles sont facultatives ?',
            'La part des envies laisse-t-elle de la place à un plan que vous pouvez tenir de façon réaliste ?',
            'L’objectif d’épargne est-il ambitieux tout en restant reproductible ?',
            'Pouvez-vous expliquer où ira chaque part du revenu ?',
          ],
        },
        {
          heading: 'Changez de stratégie quand votre vie change',
          paragraphs: [
            "Une méthode budgétaire n’est pas une identité définitive. Un déménagement, un changement d’emploi, le remboursement d’une dette, le soutien à votre famille ou l’atteinte d’un grand objectif d’épargne peuvent tous modifier la répartition qui a du sens.",
            "Réexaminez la stratégie lorsque les mêmes catégories manquent leur objectif pendant plusieurs mois. Vérifiez d’abord que les transactions sont complètes et que les plafonds sont réalistes. Si la répartition globale ne convient toujours pas, changez de structure de départ plutôt que de lutter sans cesse contre elle.",
          ],
        },
        {
          heading: 'La régularité compte plus que l’étiquette',
          paragraphs: [
            "La meilleure méthode est celle qui vous aide à décider avant de dépenser et à examiner le résultat ensuite. Son nom compte moins que la capacité des chiffres à refléter vos revenus, couvrir vos vrais besoins et réserver volontairement une part aux envies comme à l’épargne.",
            "Commencez par la solution la plus proche, ajustez-la à partir de vos dépenses réelles et revoyez-la lorsque votre situation évolue. Une méthode budgétaire devient alors un outil mensuel pratique plutôt qu’une règle figée.",
          ],
        },
      ],
    },
    'track-cash-wallet-spending': {
      title: 'La fuite du portefeuille : quand les petites dépenses en espèces s’accumulent discrètement',
      excerpt:
        "Les dépenses par carte sont faciles à suivre. C’est avec les espèces que les budgets prennent souvent l’eau. Quelques habitudes pour rendre à nouveau visibles les dépenses du portefeuille.",
      sections: [
        {
          heading: 'Les espèces deviennent invisibles plus vite que les paiements par carte',
          paragraphs: [
            "Un paiement par carte laisse généralement une ligne consultable dans l’application bancaire. Les espèces ne laissent qu’un reçu, quelques pièces ou un souvenir. Les petits achats semblent inoffensifs pris séparément : il est donc facile de remettre leur saisie à plus tard et de les oublier.",
            "Le résultat est un décalage familier : le budget indique qu’il reste de l’argent, mais le portefeuille est presque vide. Le montant manquant n’est souvent pas une grosse dépense ; c’est une série de trajets, d’encas, de pourboires et d’achats rapides qui ne sont jamais entrés dans le suivi.",
          ],
        },
        {
          heading: 'Considérez le portefeuille comme un solde, pas comme une catégorie',
          paragraphs: [
            "Un portefeuille indique où l’argent est détenu. Il n’explique pas à quoi cet argent sert. Les espèces d’un même portefeuille peuvent payer des courses, des transports ou des loisirs ; chaque achat a donc toujours besoin d’une catégorie de dépenses.",
            "Quand vous retirez des espèces, enregistrez un transfert de la banque vers le portefeuille. N’enregistrez pas le retrait comme une dépense : votre argent total n’a pas encore diminué. Enregistrez la dépense seulement lorsque les espèces sont réellement utilisées, et réduisez alors le solde du portefeuille.",
          ],
          callout:
            "Retrait : le solde bancaire diminue et le portefeuille augmente. Achat en espèces : le portefeuille diminue et la catégorie de dépenses concernée augmente.",
        },
        {
          heading: 'Adoptez une habitude de saisie qui ne prend que quelques secondes',
          paragraphs: [
            "La meilleure routine de suivi est celle que vous pouvez répéter tant que l’achat est encore frais. Saisissez le montant immédiatement, gardez le reçu dans une poche jusqu’à son enregistrement, ou ajoutez toutes les dépenses en espèces à une heure fixe chaque soir.",
            "N’attendez pas d’avoir un nom de catégorie parfait. Une description claire, un montant, une grande catégorie et le portefeuille comme lieu de paiement suffisent. Vous pourrez affiner l’entrée plus tard ; reconstituer des dépenses en espèces oubliées est beaucoup plus difficile.",
          ],
          bullets: [
            'Enregistrez l’achat avant de ranger le portefeuille.',
            'Si ce n’est pas pratique, gardez tous les reçus non enregistrés au même endroit.',
            'Utilisez un rappel quotidien jusqu’à ce que l’action devienne automatique.',
            'Évitez une catégorie générale « espèces » ; classez l’achat selon son véritable but.',
          ],
        },
        {
          heading: 'Rapprochez le portefeuille une fois par semaine',
          paragraphs: [
            "Comptez les espèces de votre portefeuille et comparez-les au solde suivi. Si l’écart est faible, examinez les reçus récents et les achats habituels. Corrigez autant que possible les entrées manquantes au lieu de modifier silencieusement le solde.",
            "Une vérification hebdomadaire raccourcit la période à examiner. Elle indique aussi si le problème vient de transactions manquantes ou d’une catégorie qui utilise régulièrement plus d’espèces que prévu.",
          ],
        },
        {
          heading: 'Donnez aux espèces une limite volontaire',
          paragraphs: [
            "Certaines personnes trouvent plus simple de transférer une somme prévue dans le portefeuille au début de la semaine. Cette somme n’est pas une nouvelle catégorie budgétaire : c’est une limite concrète de l’argent disponible immédiatement en espèces.",
            "Lorsque le portefeuille se vide, vérifiez les soldes des catégories avant d’y ajouter de l’argent. Cette pause rend les petites dépenses visibles et évite que des retraits répétés cachent ce qui a déjà été utilisé.",
          ],
        },
        {
          heading: 'Le but est un suivi honnête, pas une mémoire parfaite',
          paragraphs: [
            "Le suivi des espèces fonctionne lorsque les transferts et les achats sont traités comme des événements différents. Enregistrez l’endroit où les espèces ont été déplacées, puis ce qu’elles ont payé. Une courte habitude de saisie et un comptage régulier du portefeuille comblent la plupart des écarts.",
            "Une fois les dépenses en espèces visibles, elles peuvent être planifiées comme toute autre dépense. Vous pouvez décider si une catégorie a besoin d’un plafond plus élevé, si une habitude doit changer ou si transporter moins d’espèces rend le mois plus simple à gérer.",
          ],
        },
      ],
    },
  },
  ar: {
    'what-its-for-vs-where-it-is': {
      title: 'لماذا «لأي غرض» و«أين يوجد» سؤالان مختلفان عن المال',
      excerpt:
        'ينشأ معظم الإحباط من الميزانية عند خلط أمرين ينبغي أن يبقيا منفصلين: ما الذي يُفترض أن يغطيه مالك، وأين يوجد فعلياً الآن.',
      sections: [
        {
          heading: 'الميزانية والرصيد يجيبان عن سؤالين مختلفين',
          paragraphs: [
            'تصف الميزانية نيتك. فهي تعطي دخلك مهاماً مثل الإيجار والبقالة والترفيه والادخار. أما الرصيد فيصف المكان: المبلغ الموجود حالياً في الحساب البنكي أو في المنزل أو في المحفظة.',
            'ترتبط هاتان النظرتان ببعضهما، لكن لا يمكن استبدال إحداهما بالأخرى. فقد يتوزع المال المخصص للبقالة بين البنك والمحفظة. وقد يشمل رصيدك البنكي في الوقت نفسه مالاً مخصصاً للإيجار والادخار وفئات أخرى عديدة.',
          ],
        },
        {
          heading: 'السؤال الأول: لأي غرض هذا المال؟',
          paragraphs: [
            'هذا هو جانب التخطيط في الميزانية. يقسم سمارت جيب الخطة إلى احتياجات ورغبات وادخار. وتمنح الفئات هذه المظاريف الواسعة معنى عملياً: فالإيجار والبقالة الأساسية قد يندرجان ضمن الاحتياجات، بينما الخروج أو الترفيه قد يندرجان ضمن الرغبات.',
            'ينبغي أن يبقى الجواب ذا معنى حتى لو نقلت نقداً من البنك إلى المحفظة. فالنقل يغير مكان الاحتفاظ بالمال، لكنه لا يحول مال البقالة إلى مال للترفيه ولا يغير غرض مدخراتك.',
          ],
          bullets: [
            'تغطي الاحتياجات الالتزامات الأساسية وضروريات الحياة اليومية.',
            'تغطي الرغبات الإنفاق الاختياري الذي يمكن تعديله في العادة.',
            'يغطي الادخار المال المخصص للأهداف أو للاستخدام المستقبلي.',
          ],
        },
        {
          heading: 'السؤال الثاني: أين يوجد المال؟',
          paragraphs: [
            'المكان مسألة محاسبية. إذا سحبت 300 من البنك ووضعتها في محفظتك، فلن يتغير إجمالي أموالك. ينخفض رصيد البنك بمقدار 300 ويرتفع رصيد المحفظة بالمقدار نفسه.',
            'تسجيل المكان مهم عند الدفع. ينبغي أن يخفض الشراء النقدي رصيد المحفظة، بينما يخفض الشراء بالبطاقة رصيد البنك. وهكذا يصبح كل مكان رصيداً حقيقياً لا مجرد ملاحظة تقريبية.',
          ],
        },
        {
          heading: 'ما الذي يحدث عند خلط النظرتين؟',
          paragraphs: [
            'لنفترض أن خطتك تخصص 2,000 للاحتياجات، لكن لديك حالياً 1,500 في البنك و500 في المحفظة. اعتبار البنك فئةً في الميزانية يوحي بأن مال البنك فقط هو الذي يستطيع دفع الاحتياجات. واعتبار الاحتياجات حساباً يجعل من المستحيل معرفة ما إذا كان في المحفظة نقد كافٍ فعلاً.',
            'يزداد الالتباس وضوحاً بعد التحويلات أو الإنفاق النقدي أو تمويل هدف ادخار. فقد يغير إجراءٌ ما المكان من دون تغيير الخطة، بينما قد يستخدم إجراء آخر فئةً من الميزانية ويخفض مكاناً في الوقت نفسه.',
          ],
          callout:
            'قاعدة مفيدة: تشرح الفئات الغرض، وتشرح أماكن المال الموقع. يغير التحويل الموقع، بينما تغير المصروفات كلاً من الموقع والمبلغ المنفق من الخطة.',
        },
        {
          heading: 'سير عمل شهري عملي',
          paragraphs: [
            'ابدأ بتوزيع دخلك على الاحتياجات والرغبات والادخار. ثم سجل المبالغ الافتتاحية الموجودة في كل مكان للمال. خلال الشهر، اختر لكل مصروف فئةً ومكان دفع معاً. وسجل التحويلات منفصلة حتى لا تظهر كأنها إنفاق.',
            'راجع النظرتين لأسباب مختلفة. استخدم تقدم الفئات لتقرر إن كان إنفاقك ما زال يطابق الخطة. واستخدم أرصدة أماكن المال لتقرر إن كان البنك أو المنزل أو المحفظة يملك ما يكفي للدفع التالي.',
          ],
          bullets: [
            'خطط دخلك حسب الغرض في بداية الشهر.',
            'تتبع البنك والمنزل والمحفظة كأرصدة منفصلة.',
            'سجل التحويلات من دون احتسابها دخلاً أو إنفاقاً.',
            'لكل مصروف، سجل غرضه والمكان الذي دُفع منه.',
          ],
        },
        {
          heading: 'الوضوح يأتي من الاحتفاظ بالنظرتين',
          paragraphs: [
            'يمكن لميزانية تعتمد على الفئات فقط أن تبين أنك أنفقت أكثر من اللازم على تناول الطعام خارج المنزل، لكنها لا تبين إن كان النقد الناقص جاء من محفظتك أم من البنك. ويمكن لمتتبع الأرصدة فقط أن يبين كم يوجد في كل مكان، لا إن كان هذا المال محجوزاً لإيجار الأسبوع المقبل.',
            'الفصل بين الغرض والمكان يمنحك الإجابتين من دون إرغام مجموعة واحدة من التسميات على أداء مهمتين. وهذا التمييز هو أساس مظاريف سمارت جيب للاحتياجات والرغبات والادخار وأماكن المال فيه: البنك والمنزل والمحفظة.',
          ],
        },
      ],
    },
    'pick-a-budgeting-style': {
      title: 'اختيار أسلوب ميزانية يناسبك فعلاً',
      excerpt:
        'قاعدة 50/30/20 لا تناسب الجميع. إليك طريقة التفكير في التقسيم بين الاحتياجات والرغبات والادخار بما يطابق حياتك الفعلية.',
      sections: [
        {
          heading: 'طريقة الميزانية هي هيكل بداية',
          paragraphs: [
            'تعطي طريقة الميزانية كل جزء من دخلك مهمة افتراضية. وقد تقلل عدد القرارات التي تتخذها شهرياً، لكنها لا تعرف إيجارك أو مسؤولياتك العائلية أو دخلك غير المنتظم أو هدف ادخارك الحالي.',
            'السؤال المفيد ليس: أي طريقة هي الأفضل للجميع؟ بل: أي هيكل بداية يشبه التزاماتك الحقيقية أكثر والعادة التي تريد بناءها لاحقاً؟',
          ],
        },
        {
          heading: 'ابدأ باحتياجاتك غير القابلة للتفاوض',
          paragraphs: [
            'اكتب تكاليف السكن الأساسية والمرافق والطعام والنقل والصحة والحد الأدنى من التزامات الدين. قارن مجموعها الشهري بدخلك الصافي. يمنحك ذلك نسبة للاحتياجات مبنية على الواقع لا على قاعدة عامة.',
            'إذا كانت التكاليف الأساسية تستهلك أكثر من نصف دخلك أصلاً، فلن يؤدي فرض حد 50% عليها إلى اختفاء الفواتير. اختر هيكلاً يترك مساحة أكبر للاحتياجات، ثم ابحث عن تغييرات يمكن تحقيقها فعلاً مع الوقت.',
          ],
          callout:
            'استخدم النسب المئوية كأدلة للتخطيط لا كحكم نهائي. فالميزانية الواقعية التي يمكنك اتباعها أنفع من تقسيم مثالي يفشل كل شهر.',
        },
        {
          heading: 'الاستراتيجيات الأربع المتاحة في سمارت جيب',
          paragraphs: [
            'يوفر سمارت جيب أربع استراتيجيات. تقسم كل منها الدخل بين الاحتياجات والرغبات والادخار، مع إبقاء إمكانية تعديل حدود الفئات لتناسب شهرك.',
          ],
          bullets: [
            'تخصص قاعدة 50/30/20 نسبة 50% للاحتياجات و30% للرغبات و20% للادخار. وهي بداية متوازنة عندما تتناسب الضروريات مع نحو نصف الدخل.',
            'تبدأ ميزانية الصفر في سمارت جيب بنسبة 60% للاحتياجات و25% للرغبات و15% للادخار. وعادتها الأساسية هي إعطاء كل الدخل مهمة واضحة بدلاً من ترك مال بلا خطة.',
            'تبدأ ميزانية المظاريف بنسبة 55% للاحتياجات و35% للرغبات و10% للادخار. وهي مناسبة لمن يريد حدوداً مرئية للفئات ومراجعات متكررة للإنفاق.',
            'تخصص استراتيجية ادفع لنفسك أولاً 45% للاحتياجات و25% للرغبات و30% للادخار. فهي تضع حصة ادخار أكبر قبل الإنفاق الاختياري.',
          ],
        },
        {
          heading: 'اختر بناءً على المشكلة التي تريد حلها',
          paragraphs: [
            'إذا كنت تحتاج أساساً بسيطاً في المقام الأول، فابدأ بـ 50/30/20. وإذا بقي المال بلا تخصيص بانتظام ثم اختفى، فإن ميزانية الصفر تمنحه مهمة. وإذا تجاوزت فئة أو فئتان الحدود مراراً، فإن ميزانية المظاريف تجعل تلك الحدود أسهل رؤية.',
            'قد تساعدك استراتيجية ادفع لنفسك أولاً إذا كان الادخار يؤجل دائماً حتى نهاية الشهر. وهي تعمل أفضل عندما تترك حصة الادخار الأعلى ما يكفي للالتزامات الأساسية.',
          ],
        },
        {
          heading: 'اختبر الطريقة على شهر حقيقي',
          paragraphs: [
            'قبل الالتزام، طبق التقسيم على دخلك الصافي للشهر الماضي. قارن المبالغ الناتجة بما أنفقته فعلاً على الاحتياجات والرغبات والادخار. لا ينبغي أن يحسم شهر غير اعتيادي كل شيء، لذا كرر المقارنة لشهرين أو ثلاثة إن كانت لديك السجلات.',
            'ابحث عن حجم الفارق واتجاهه. يمكن معالجة فرق صغير بتعديل حدود الفئات. أما الفرق الكبير والمتكرر فيعني غالباً أن الاستراتيجية ليست نقطة البداية المناسبة بعد.',
          ],
          bullets: [
            'هل تستطيع حصة الاحتياجات تغطية الفواتير الأساسية من دون ادعاء أنها اختيارية؟',
            'هل تترك حصة الرغبات مجالاً لخطة يمكنك الحفاظ عليها واقعياً؟',
            'هل هدف الادخار طموح لكنه قابل للتكرار؟',
            'هل يمكنك شرح إلى أين سيذهب كل جزء من الدخل؟',
          ],
        },
        {
          heading: 'غيّر الاستراتيجية حين تتغير حياتك',
          paragraphs: [
            'طريقة الميزانية ليست هوية دائمة. فالانتقال إلى بيت جديد أو تغيير الوظيفة أو سداد دين أو دعم العائلة أو بلوغ هدف ادخار كبير، كلها قد تغير التقسيم المنطقي.',
            'راجع الاستراتيجية عندما تفشل الفئات نفسها في بلوغ أهدافها عدة أشهر. تحقق أولاً من اكتمال المعاملات وواقعية حدود الفئات. وإذا ظل التقسيم الكلي غير مناسب، فغيّر هيكل البداية بدلاً من الاستمرار في محاربته.',
          ],
        },
        {
          heading: 'الاستمرارية أهم من الاسم',
          paragraphs: [
            'أفضل طريقة هي التي تساعدك على اتخاذ القرارات قبل الإنفاق ومراجعة النتيجة بعده. اسمها أقل أهمية من أن تعكس الأرقام دخلك وتغطي الاحتياجات الحقيقية وتترك مبلغاً مقصوداً للرغبات والادخار معاً.',
            'ابدأ بأقرب ما يناسبك، وعدله باستخدام إنفاقك الحقيقي، وأعد النظر فيه حين تتغير الظروف. هكذا يتحول أسلوب الميزانية من قاعدة جامدة إلى أداة شهرية عملية.',
          ],
        },
      ],
    },
    'track-cash-wallet-spending': {
      title: 'تسرّب المحفظة: كيف تتراكم المصاريف النقدية الصغيرة بهدوء',
      excerpt:
        'من السهل تتبع الإنفاق بالبطاقة. أما النقد فهو المكان الذي تتسرب منه الميزانيات غالباً. إليك عادات تجعل إنفاق المحفظة مرئياً من جديد.',
      sections: [
        {
          heading: 'يصبح النقد غير مرئي أسرع من إنفاق البطاقة',
          paragraphs: [
            'عادةً ما يترك الدفع بالبطاقة سطراً قابلاً للبحث في تطبيق البنك. أما النقد فلا يترك سوى إيصال أو بعض العملات أو ذكرى. تبدو المشتريات الصغيرة غير مؤذية وحدها، لذلك يسهل تأجيل تسجيلها ونسيانها.',
            'والنتيجة فرق مألوف: تقول الميزانية إن المال لا يزال متبقياً، لكن المحفظة تكاد تكون فارغة. وغالباً لا يكون المبلغ المفقود مصروفاً كبيراً واحداً، بل سلسلة من أجور النقل والوجبات الخفيفة والإكراميات والمشتريات السريعة التي لم تصل إلى السجل.',
          ],
        },
        {
          heading: 'عامل المحفظة كرصيد لا كفئة',
          paragraphs: [
            'تخبرك المحفظة بمكان الاحتفاظ بالمال، ولا تشرح الغرض منه. يمكن للنقد في المحفظة نفسها أن يدفع للبقالة أو النقل أو الترفيه، لذلك يحتاج كل شراء إلى فئة إنفاق أيضاً.',
            'عندما تسحب نقداً، سجل تحويلاً من البنك إلى المحفظة. لا تسجل السحب كمصروف: فإجمالي أموالك لم ينخفض بعد. سجل المصروف فقط عند إنفاق النقد فعلاً، وخفّض رصيد المحفظة حينها.',
          ],
          callout:
            'سحب نقدي: ينخفض رصيد البنك ويرتفع رصيد المحفظة. شراء نقدي: ينخفض رصيد المحفظة وترتفع مصروفات الفئة المعنية.',
        },
        {
          heading: 'استخدم عادة تسجيل لا تستغرق سوى ثوانٍ',
          paragraphs: [
            'أفضل روتين للتتبع هو الذي يمكنك تكراره بينما لا تزال عملية الشراء حاضرة في ذهنك. أدخل المبلغ فوراً، أو احتفظ بالإيصال في جيب واحد حتى تسجله، أو أضف كل مشتريات النقد في وقت ثابت كل مساء.',
            'لا تنتظر اسماً مثالياً للفئة. يكفي وصف واضح ومبلغ وفئة واسعة والمحفظة كمكان للدفع. يمكنك تحسين الإدخال لاحقاً؛ أما إعادة بناء إنفاق نقدي منسي فهي أصعب بكثير.',
          ],
          bullets: [
            'سجل الشراء قبل أن تعيد المحفظة إلى مكانها.',
            'إن لم يكن ذلك عملياً، احتفظ بكل إيصال غير مسجل في مكان واحد.',
            'استخدم تذكيراً يومياً حتى يصبح الفعل تلقائياً.',
            'تجنب فئة عامة باسم «نقد»؛ صنف الشراء وفق ما خُصص له فعلاً.',
          ],
        },
        {
          heading: 'طابق رصيد المحفظة مرة كل أسبوع',
          paragraphs: [
            'عدّ النقد في محفظتك وقارنه برصيد المحفظة الذي تتبعه. إن كان الفرق صغيراً، راجع الإيصالات الأخيرة والمشتريات المعتادة. صحح الإدخالات الناقصة بدلاً من تغيير الرصيد بصمت كلما أمكن.',
            'تجعل المراجعة الأسبوعية نافذة البحث قصيرة. كما تبين ما إذا كانت المشكلة معاملات ناقصة أم فئة تستهلك نقداً أكثر مما خططت له باستمرار.',
          ],
        },
        {
          heading: 'ضع للنقد حداً مقصوداً',
          paragraphs: [
            'يجد بعض الناس أنه من الأسهل نقل مبلغ مخطط له إلى المحفظة في بداية الأسبوع. هذا المبلغ ليس فئة ميزانية جديدة؛ بل حد عملي لكمية النقد المتاحة فوراً.',
            'عندما ينخفض رصيد المحفظة، راجع أرصدة الفئات قبل إضافة المزيد. يجعل التوقف المصاريف الصغيرة مرئية ويمنع السحوبات المتكررة من إخفاء مقدار ما استُخدم بالفعل.',
          ],
        },
        {
          heading: 'الهدف سجل صادق لا ذاكرة مثالية',
          paragraphs: [
            'ينجح تتبع النقد حين تعامل التحويلات والمشتريات كأحداث مختلفة. سجل المكان الذي انتقل إليه النقد، ثم سجل ما دفع ثمنه. عادة تسجيل قصيرة وعدّ منتظم للمحفظة يسدان معظم الفجوة.',
            'عندما يصبح الإنفاق النقدي مرئياً، يمكن التخطيط له مثل أي إنفاق آخر. يمكنك أن تقرر إن كانت فئة تحتاج حداً أكبر، أو إن كانت عادة تحتاج إلى تغيير، أو إن كان حمل نقد أقل يجعل إدارة الشهر أسهل.',
          ],
        },
      ],
    },
  },
};

export function getLocalizedBlogPosts(language: Language): readonly BlogPost[] {
  const translations = BLOG_TRANSLATIONS[language];
  if (!translations) return BLOG_POSTS;

  return BLOG_POSTS.map((post) => {
    const translation = translations[post.slug];
    return translation ? { ...post, ...translation } : post;
  });
}

export function getLocalizedBlogPost(slug: string, language: Language): BlogPost | undefined {
  return getLocalizedBlogPosts(language).find((post) => post.slug === slug);
}
