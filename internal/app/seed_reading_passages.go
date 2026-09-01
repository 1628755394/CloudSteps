package app

import (
	"encoding/json"
	"unicode"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"gorm.io/gorm"
)

type seedReadingQuestion struct {
	Stem        string
	Options     []map[string]string
	Answer      string
	Explanation string
}

type seedReadingPassage struct {
	Title            string
	Level            string
	Summary          string
	Content          string
	EstimatedMinutes int
	SortOrder        int
	Questions        []seedReadingQuestion
}

func countReadingWords(s string) int {
	n := 0
	inWord := false
	for _, r := range s {
		if unicode.IsLetter(r) {
			if !inWord {
				n++
				inWord = true
			}
		} else {
			inWord = false
		}
	}
	return n
}

// defaultReadingPassages 阅读理解 seed 数据。
// 短文为公共领域故事改编或原创 ESL 材料，仅供学习练习。
func defaultReadingPassages() []seedReadingPassage {
	core := []seedReadingPassage{
		{
			Title:            "A Morning Walk",
			Level:            "初阶",
			Summary:          "Lisa 在公园散步时遇见一位喂鸭子的老人。",
			EstimatedMinutes: 4,
			SortOrder:        1,
			Content: `Every morning, Lisa walks in the park near her home. She likes to see the flowers and listen to the birds. Last Saturday, she met an old man who was feeding ducks by the lake.

The man smiled and said, "The ducks are hungry today." Lisa helped him throw some bread into the water. The ducks swam closer and quacked happily.

After that, Lisa felt warm inside. She decided to visit the park more often, not only for exercise, but also to meet kind people and enjoy small moments of joy.`,
			Questions: []seedReadingQuestion{
				{
					Stem: "Where does Lisa walk every morning?",
					Options: []map[string]string{
						{"key": "A", "text": "In a shopping mall"},
						{"key": "B", "text": "In the park near her home"},
						{"key": "C", "text": "Along the beach"},
						{"key": "D", "text": "Around her school"},
					},
					Answer: "B", Explanation: "首段写到 she walks in the park near her home。",
				},
				{
					Stem: "What was the old man doing by the lake?",
					Options: []map[string]string{
						{"key": "A", "text": "Reading a newspaper"},
						{"key": "B", "text": "Taking photos"},
						{"key": "C", "text": "Feeding ducks"},
						{"key": "D", "text": "Fishing"},
					},
					Answer: "C", Explanation: "an old man who was feeding ducks。",
				},
				{
					Stem: "How did Lisa feel after helping the old man?",
					Options: []map[string]string{
						{"key": "A", "text": "Tired and bored"},
						{"key": "B", "text": "Angry and upset"},
						{"key": "C", "text": "Warm and happy"},
						{"key": "D", "text": "Nervous and shy"},
					},
					Answer: "C", Explanation: "Lisa felt warm inside。",
				},
			},
		},
		{
			Title:            "The Lost Library Card",
			Level:            "初阶",
			Summary:          "Tom 丢了借书卡，在图书馆工作人员帮助下找回。",
			EstimatedMinutes: 5,
			SortOrder:        2,
			Content: `Tom loves reading. Every weekend he goes to the city library. Last Sunday, he wanted to borrow a science book, but he could not find his library card.

He looked in his bag, pockets, and even under the desk. Nothing. He felt worried. Without the card, he could not take books home.

A librarian noticed him and asked what was wrong. Tom explained the problem. The librarian checked the computer and said, "Your card is still valid. I can print a temporary card for you today."

Tom thanked her and borrowed the book. On the way home, he found his old card in a jacket pocket. He laughed and decided to keep both cards carefully from then on.`,
			Questions: []seedReadingQuestion{
				{
					Stem: "Why did Tom feel worried at the library?",
					Options: []map[string]string{
						{"key": "A", "text": "The library was closed"},
						{"key": "B", "text": "He could not find his library card"},
						{"key": "C", "text": "He forgot the book title"},
						{"key": "D", "text": "He lost his bag"},
					},
					Answer: "B", Explanation: "He could not find his library card。",
				},
				{
					Stem: "How did the librarian help Tom?",
					Options: []map[string]string{
						{"key": "A", "text": "She sold him a new book"},
						{"key": "B", "text": "She called his parents"},
						{"key": "C", "text": "She printed a temporary card"},
						{"key": "D", "text": "She closed the computer"},
					},
					Answer: "C", Explanation: "I can print a temporary card for you today。",
				},
				{
					Stem: "Where did Tom finally find his old card?",
					Options: []map[string]string{
						{"key": "A", "text": "In a jacket pocket"},
						{"key": "B", "text": "On the librarian's desk"},
						{"key": "C", "text": "Inside the science book"},
						{"key": "D", "text": "Under a chair"},
					},
					Answer: "A", Explanation: "he found his old card in a jacket pocket。",
				},
			},
		},
		{
			Title:            "The Tortoise and the Hare",
			Level:            "初阶",
			Summary:          "经典寓言改编：慢而稳的乌龟赢得了比赛。",
			EstimatedMinutes: 4,
			SortOrder:        3,
			Content: `A hare laughed at a tortoise for being so slow. "I can run to that tree and back before you take ten steps," the hare said.

They agreed to race. The hare ran fast at first and soon was far ahead. Confident of winning, he lay down under a shady tree and fell asleep.

The tortoise never stopped. Step by step, he moved forward while the hare slept. When the hare woke up, he saw the tortoise near the finish line. He ran as fast as he could, but it was too late.

The tortoise won. The other animals cheered. The story reminds us that steady effort can beat careless speed.`,
			Questions: []seedReadingQuestion{
				{
					Stem: "Why did the hare stop running during the race?",
					Options: []map[string]string{
						{"key": "A", "text": "He was injured"},
						{"key": "B", "text": "He fell asleep under a tree"},
						{"key": "C", "text": "He got lost"},
						{"key": "D", "text": "The tortoise asked him to wait"},
					},
					Answer: "B", Explanation: "he lay down under a shady tree and fell asleep。",
				},
				{
					Stem: "Who won the race?",
					Options: []map[string]string{
						{"key": "A", "text": "The hare"},
						{"key": "B", "text": "The tortoise"},
						{"key": "C", "text": "Neither of them"},
						{"key": "D", "text": "Both of them"},
					},
					Answer: "B", Explanation: "The tortoise won。",
				},
				{
					Stem: "What is the main lesson of the story?",
					Options: []map[string]string{
						{"key": "A", "text": "Sleep is more important than work"},
						{"key": "B", "text": "Steady effort can beat careless speed"},
						{"key": "C", "text": "Trees provide good shade"},
						{"key": "D", "text": "Hares are always lazy"},
					},
					Answer: "B", Explanation: "steady effort can beat careless speed。",
				},
			},
		},
		{
			Title:            "The Ant and the Grasshopper",
			Level:            "初阶",
			Summary:          "寓言改编：蚂蚁勤劳储存，蚱蜢夏天贪玩。",
			EstimatedMinutes: 4,
			SortOrder:        4,
			Content: `All summer long, a grasshopper sang and played in the sun. An ant passed by carrying food to its nest. "Why don't you rest and enjoy the weather?" the grasshopper asked.

"I am storing food for winter," the ant replied. "You should prepare too."

The grasshopper laughed. "Winter is far away. There is plenty of time."

When cold days arrived, snow covered the ground. The grasshopper had no food and knocked on the ant's door. The ant shared a little, but said, "Next summer, plan ahead."

The grasshopper learned that fun today should not replace responsibility tomorrow.`,
			Questions: []seedReadingQuestion{
				{
					Stem: "What was the ant doing in summer?",
					Options: []map[string]string{
						{"key": "A", "text": "Singing all day"},
						{"key": "B", "text": "Storing food for winter"},
						{"key": "C", "text": "Building a school"},
						{"key": "D", "text": "Traveling abroad"},
					},
					Answer: "B", Explanation: "I am storing food for winter。",
				},
				{
					Stem: "What happened when winter came?",
					Options: []map[string]string{
						{"key": "A", "text": "The grasshopper had plenty of food"},
						{"key": "B", "text": "The ant moved to another country"},
						{"key": "C", "text": "The grasshopper had no food"},
						{"key": "D", "text": "Summer returned quickly"},
					},
					Answer: "C", Explanation: "The grasshopper had no food。",
				},
				{
					Stem: "What did the grasshopper learn?",
					Options: []map[string]string{
						{"key": "A", "text": "Ants are unkind"},
						{"key": "B", "text": "Winter never comes"},
						{"key": "C", "text": "Fun today should not replace responsibility tomorrow"},
						{"key": "D", "text": "Snow is dangerous"},
					},
					Answer: "C", Explanation: "fun today should not replace responsibility tomorrow。",
				},
			},
		},
		{
			Title:            "A School Recycling Project",
			Level:            "初阶",
			Summary:          "学生们发起校园垃圾分类与回收活动。",
			EstimatedMinutes: 5,
			SortOrder:        5,
			Content: `Last month, Class 3B started a recycling project. Students noticed that the playground bins were always mixed with plastic bottles, paper, and food waste.

They made colorful labels and gave a short talk in the morning assembly. Each classroom got two boxes: one for paper and one for plastic.

At first, only a few students took part. After two weeks, teachers joined in too. The janitor said the amount of general waste dropped by nearly half.

The head teacher praised the class on Friday. "Small habits can change a whole school," she said. Class 3B now plans to add a box for batteries next term.`,
			Questions: []seedReadingQuestion{
				{
					Stem: "What problem did Class 3B notice?",
					Options: []map[string]string{
						{"key": "A", "text": "The library was too small"},
						{"key": "B", "text": "Playground bins mixed different types of waste"},
						{"key": "C", "text": "There were no bins at all"},
						{"key": "D", "text": "Students forgot their homework"},
					},
					Answer: "B", Explanation: "bins were always mixed with plastic bottles, paper, and food waste。",
				},
				{
					Stem: "How did the class encourage others to recycle?",
					Options: []map[string]string{
						{"key": "A", "text": "They closed the playground"},
						{"key": "B", "text": "They made labels and gave a morning talk"},
						{"key": "C", "text": "They sold recycled products online"},
						{"key": "D", "text": "They punished students who did not recycle"},
					},
					Answer: "B", Explanation: "made colorful labels and gave a short talk in the morning assembly。",
				},
				{
					Stem: "What result did the janitor report?",
					Options: []map[string]string{
						{"key": "A", "text": "General waste increased"},
						{"key": "B", "text": "General waste dropped by nearly half"},
						{"key": "C", "text": "No change at all"},
						{"key": "D", "text": "Paper waste doubled"},
					},
					Answer: "B", Explanation: "the amount of general waste dropped by nearly half。",
				},
			},
		},
		{
			Title:            "Working From a Café",
			Level:            "中阶",
			Summary:          "远程工作者 Maya 发现咖啡馆并不总适合专注工作。",
			EstimatedMinutes: 6,
			SortOrder:        10,
			Content: `Maya works remotely for a design company. At first, she believed cafés were the perfect workplace: good coffee, soft music, and a lively atmosphere. She would arrive early, open her laptop, and stay until late afternoon.

After a few weeks, however, she noticed a problem. The noise made it hard to join video meetings, and the Wi-Fi was unstable during busy hours. She also spent more money than expected on drinks.

So Maya changed her routine. She now works at home in the morning when she needs deep focus, and visits a café only in the afternoon for lighter tasks like emails. She says the mix helps her stay productive without feeling lonely.

"A café is great for inspiration," she told a friend, "but not always for concentration."`,
			Questions: []seedReadingQuestion{
				{
					Stem: "What problems did Maya face in cafés?",
					Options: []map[string]string{
						{"key": "A", "text": "No seats available"},
						{"key": "B", "text": "Noise and unstable Wi-Fi"},
						{"key": "C", "text": "Her laptop was broken"},
						{"key": "D", "text": "Coffee tasted bad"},
					},
					Answer: "B", Explanation: "noise ... and the Wi-Fi was unstable。",
				},
				{
					Stem: "What is Maya's new routine?",
					Options: []map[string]string{
						{"key": "A", "text": "She only works in cafés"},
						{"key": "B", "text": "She works at home in the morning and goes to a café later"},
						{"key": "C", "text": "She quit remote work"},
						{"key": "D", "text": "She never drinks coffee"},
					},
					Answer: "B", Explanation: "works at home in the morning ... visits a café only in the afternoon。",
				},
				{
					Stem: "According to Maya, cafés are great for ______.",
					Options: []map[string]string{
						{"key": "A", "text": "inspiration"},
						{"key": "B", "text": "long meetings"},
						{"key": "C", "text": "saving money"},
						{"key": "D", "text": "deep coding"},
					},
					Answer: "A", Explanation: "A café is great for inspiration。",
				},
			},
		},
		{
			Title:            "The First Flight at Kitty Hawk",
			Level:            "中阶",
			Summary:          "莱特兄弟 1903 年首飞的历史简述（公共领域史实改编）。",
			EstimatedMinutes: 6,
			SortOrder:        11,
			Content: `On December 17, 1903, Orville and Wilbur Wright made history at Kitty Hawk, North Carolina. Their powered aircraft, the Wright Flyer, stayed in the air for twelve seconds and covered about thirty-seven meters.

The brothers had tested gliders for years and studied how birds control flight. They built a lightweight engine and designed propellers that pushed air backward.

The first flight was short, but it proved that controlled, powered flight was possible. News spread slowly at first, yet the achievement changed transportation forever.

Today, millions of people fly every day. The Wright brothers' careful experiments remind us that big changes often begin with small, uncertain steps.`,
			Questions: []seedReadingQuestion{
				{
					Stem: "How long did the first powered flight last?",
					Options: []map[string]string{
						{"key": "A", "text": "Twelve seconds"},
						{"key": "B", "text": "Twelve minutes"},
						{"key": "C", "text": "One hour"},
						{"key": "D", "text": "Thirty-seven seconds"},
					},
					Answer: "A", Explanation: "stayed in the air for twelve seconds。",
				},
				{
					Stem: "What did the Wright brothers study before building their engine?",
					Options: []map[string]string{
						{"key": "A", "text": "How ships cross oceans"},
						{"key": "B", "text": "How birds control flight"},
						{"key": "C", "text": "How trains use steam"},
						{"key": "D", "text": "How fish swim in rivers"},
					},
					Answer: "B", Explanation: "studied how birds control flight。",
				},
				{
					Stem: "What is the author's main point in the last paragraph?",
					Options: []map[string]string{
						{"key": "A", "text": "Flying is too expensive today"},
						{"key": "B", "text": "Big changes can start with small steps"},
						{"key": "C", "text": "Kitty Hawk is a popular tourist city"},
						{"key": "D", "text": "News always spreads quickly"},
					},
					Answer: "B", Explanation: "big changes often begin with small, uncertain steps。",
				},
			},
		},
		{
			Title:            "How Sleep Helps Your Brain",
			Level:            "中阶",
			Summary:          "科学常识：睡眠如何巩固记忆与恢复精力。",
			EstimatedMinutes: 6,
			SortOrder:        12,
			Content: `Sleep is not wasted time. While you rest, your brain organizes memories from the day and clears waste products that build up during waking hours.

Students who sleep seven to nine hours often find it easier to focus in class. In contrast, staying up all night before an exam may hurt performance because the brain has less time to strengthen new learning.

Doctors recommend a regular schedule: go to bed and wake up at similar times, even on weekends. Avoid bright screens right before sleep, and keep the bedroom cool and dark.

Good sleep will not replace study, but it makes study more effective. Think of sleep as part of your learning plan, not an enemy of it.`,
			Questions: []seedReadingQuestion{
				{
					Stem: "What does the brain do during sleep according to the passage?",
					Options: []map[string]string{
						{"key": "A", "text": "It stops working completely"},
						{"key": "B", "text": "It organizes memories and clears waste"},
						{"key": "C", "text": "It only dreams about exams"},
						{"key": "D", "text": "It stores food energy"},
					},
					Answer: "B", Explanation: "organizes memories ... and clears waste products。",
				},
				{
					Stem: "Why might staying up all night before an exam be harmful?",
					Options: []map[string]string{
						{"key": "A", "text": "The exam will be cancelled"},
						{"key": "B", "text": "The brain has less time to strengthen new learning"},
						{"key": "C", "text": "Teachers dislike early mornings"},
						{"key": "D", "text": "Books become harder to read"},
					},
					Answer: "B", Explanation: "the brain has less time to strengthen new learning。",
				},
				{
					Stem: "How does the author suggest students view sleep?",
					Options: []map[string]string{
						{"key": "A", "text": "As an enemy of study"},
						{"key": "B", "text": "As part of the learning plan"},
						{"key": "C", "text": "As unnecessary for adults"},
						{"key": "D", "text": "As a reward after graduation"},
					},
					Answer: "B", Explanation: "Think of sleep as part of your learning plan。",
				},
			},
		},
		{
			Title:            "Learning English Through Reading",
			Level:            "中阶",
			Summary:          "通过阅读提升词汇量与语感的建议。",
			EstimatedMinutes: 5,
			SortOrder:        13,
			Content: `Many learners ask whether they should memorize long word lists or read more stories. Language teachers often answer: read regularly, at a level you mostly understand.

When you read, you see words in context. You notice how grammar connects ideas, and you meet the same expressions again and again. This repetition helps memory more naturally than isolated lists.

Start with short texts and mark only a few new words per page. Look them up, write an example sentence, and return to the text later. If a book feels too difficult, choose an easier one instead of forcing yourself through every page.

Reading should be enjoyable. When you enjoy it, you read more—and when you read more, your English improves faster.`,
			Questions: []seedReadingQuestion{
				{
					Stem: "What do many language teachers recommend?",
					Options: []map[string]string{
						{"key": "A", "text": "Avoid reading until you know every word"},
						{"key": "B", "text": "Read regularly at a mostly understandable level"},
						{"key": "C", "text": "Memorize only grammar rules"},
						{"key": "D", "text": "Translate every sentence aloud"},
					},
					Answer: "B", Explanation: "read regularly, at a level you mostly understand。",
				},
				{
					Stem: "Why is reading in context helpful?",
					Options: []map[string]string{
						{"key": "A", "text": "It removes the need to study grammar"},
						{"key": "B", "text": "Repetition in context helps memory naturally"},
						{"key": "C", "text": "Books are always easier than lists"},
						{"key": "D", "text": "Teachers do not assign lists anymore"},
					},
					Answer: "B", Explanation: "This repetition helps memory more naturally。",
				},
				{
					Stem: "What should you do if a book feels too difficult?",
					Options: []map[string]string{
						{"key": "A", "text": "Stop learning English"},
						{"key": "B", "text": "Choose an easier one"},
						{"key": "C", "text": "Memorize the entire dictionary first"},
						{"key": "D", "text": "Read it twice as fast"},
					},
					Answer: "B", Explanation: "choose an easier one instead of forcing yourself。",
				},
			},
		},
		{
			Title:            "Why Cities Need Green Roofs",
			Level:            "高阶",
			Summary:          "城市屋顶绿化如何缓解热岛效应并改善生活质量。",
			EstimatedMinutes: 7,
			SortOrder:        20,
			Content: `As cities grow denser, concrete and asphalt absorb heat and create "urban heat islands." Temperatures in city centers can be several degrees higher than in surrounding suburbs. One practical response is the green roof: a building rooftop covered with soil and plants.

Green roofs do more than look attractive. Plants absorb rainwater, reducing pressure on drainage systems during storms. They also insulate buildings, which can lower energy use for cooling in summer. In some projects, bees and butterflies return to neighborhoods that once offered little habitat.

Critics argue that green roofs are expensive to install and require regular maintenance. Supporters reply that long-term savings on energy and flood damage often outweigh the initial cost, especially when cities provide subsidies.

Urban planners increasingly see green roofs not as decoration, but as infrastructure—quiet systems that make dense living healthier and more resilient.`,
			Questions: []seedReadingQuestion{
				{
					Stem: "What is an \"urban heat island\"?",
					Options: []map[string]string{
						{"key": "A", "text": "A park with many trees"},
						{"key": "B", "text": "A city area hotter than nearby suburbs"},
						{"key": "C", "text": "An island used for tourism"},
						{"key": "D", "text": "An underground cooling system"},
					},
					Answer: "B", Explanation: "Temperatures in city centers can be several degrees higher than in surrounding suburbs。",
				},
				{
					Stem: "Which is NOT mentioned as a benefit of green roofs?",
					Options: []map[string]string{
						{"key": "A", "text": "Absorbing rainwater"},
						{"key": "B", "text": "Lowering cooling energy use"},
						{"key": "C", "text": "Providing habitat for insects"},
						{"key": "D", "text": "Replacing all public parks"},
					},
					Answer: "D", Explanation: "文中未提到取代所有公园。",
				},
				{
					Stem: "What do critics mainly worry about?",
					Options: []map[string]string{
						{"key": "A", "text": "Cost and maintenance"},
						{"key": "B", "text": "Noise from plants"},
						{"key": "C", "text": "Too many butterflies"},
						{"key": "D", "text": "Lack of soil"},
					},
					Answer: "A", Explanation: "expensive to install and require regular maintenance。",
				},
			},
		},
		{
			Title:            "The Challenge of Plastic Waste",
			Level:            "高阶",
			Summary:          "塑料污染的来源、影响与解决思路。",
			EstimatedMinutes: 7,
			SortOrder:        21,
			Content: `Plastic is light, cheap, and durable—qualities that made it popular for packaging and products. Yet durability becomes a problem when plastic is thrown away after a single use. Much of it enters rivers and oceans, where it breaks into smaller pieces called microplastics.

Marine animals may mistake plastic for food. Chemicals from plastics can enter the food chain and raise health concerns for humans as well. Cleaning existing pollution is difficult because waste is spread across vast areas.

Solutions include reducing unnecessary packaging, improving recycling systems, and designing products that are easier to reuse. Some countries charge for plastic bags or ban certain single-use items.

No single policy will solve the problem overnight. Progress depends on changes in design, business practices, and everyday habits.`,
			Questions: []seedReadingQuestion{
				{
					Stem: "Why does plastic durability become a problem?",
					Options: []map[string]string{
						{"key": "A", "text": "It makes products too heavy"},
						{"key": "B", "text": "It persists as waste after single use"},
						{"key": "C", "text": "It cannot be used for packaging"},
						{"key": "D", "text": "It melts in cold water"},
					},
					Answer: "B", Explanation: "durability becomes a problem when plastic is thrown away after a single use。",
				},
				{
					Stem: "What are microplastics?",
					Options: []map[string]string{
						{"key": "A", "text": "Large fishing nets"},
						{"key": "B", "text": "Small broken pieces of plastic"},
						{"key": "C", "text": "A type of renewable energy"},
						{"key": "D", "text": "Plastic made only for hospitals"},
					},
					Answer: "B", Explanation: "breaks into smaller pieces called microplastics。",
				},
				{
					Stem: "Which solution is mentioned in the passage?",
					Options: []map[string]string{
						{"key": "A", "text": "Banning all plastic forever"},
						{"key": "B", "text": "Improving recycling and reducing packaging"},
						{"key": "C", "text": "Moving all factories to space"},
						{"key": "D", "text": "Feeding plastic to farm animals"},
					},
					Answer: "B", Explanation: "reducing unnecessary packaging, improving recycling systems。",
				},
				{
					Stem: "What does the author suggest about solving plastic pollution?",
					Options: []map[string]string{
						{"key": "A", "text": "One policy will fix everything quickly"},
						{"key": "B", "text": "Progress needs combined changes in design, business, and habits"},
						{"key": "C", "text": "Individuals cannot make any difference"},
						{"key": "D", "text": "Ocean cleaning is unnecessary"},
					},
					Answer: "B", Explanation: "Progress depends on changes in design, business practices, and everyday habits。",
				},
			},
		},
		{
			Title:            "Artificial Intelligence in Education",
			Level:            "高阶",
			Summary:          "AI 辅助学习的机遇与边界。",
			EstimatedMinutes: 8,
			SortOrder:        22,
			Content: `Artificial intelligence tools can now summarize texts, translate languages, and generate practice questions in seconds. Educators are exploring how such tools might support—not replace—human teaching.

Used thoughtfully, AI can offer personalized feedback when a teacher cannot respond to every student immediately. It may help learners review grammar patterns or check the clarity of an essay draft.

However, relying on AI too heavily carries risks. Students might submit answers they do not understand, or lose chances to struggle productively with difficult problems. Privacy is another concern: schools must know how student data is stored and used.

The most balanced approach treats AI as a assistant. Teachers still design goals, model critical thinking, and build relationships that machines cannot copy. Technology works best when it strengthens human judgment rather than bypassing it.`,
			Questions: []seedReadingQuestion{
				{
					Stem: "According to the passage, AI tools can help learners ______.",
					Options: []map[string]string{
						{"key": "A", "text": "replace all teachers"},
						{"key": "B", "text": "review grammar and check essay drafts"},
						{"key": "C", "text": "skip homework entirely"},
						{"key": "D", "text": "avoid reading books"},
					},
					Answer: "B", Explanation: "review grammar patterns or check the clarity of an essay draft。",
				},
				{
					Stem: "What is one risk of relying on AI too heavily?",
					Options: []map[string]string{
						{"key": "A", "text": "Students may submit work they do not understand"},
						{"key": "B", "text": "Computers become too slow"},
						{"key": "C", "text": "Schools will have fewer buildings"},
						{"key": "D", "text": "Translation becomes impossible"},
					},
					Answer: "A", Explanation: "Students might submit answers they do not understand。",
				},
				{
					Stem: "What approach does the author recommend?",
					Options: []map[string]string{
						{"key": "A", "text": "Ban AI completely in schools"},
						{"key": "B", "text": "Treat AI as an assistant that supports human judgment"},
						{"key": "C", "text": "Let AI design all curriculum alone"},
						{"key": "D", "text": "Ignore privacy concerns"},
					},
					Answer: "B", Explanation: "treats AI as a assistant ... strengthens human judgment。",
				},
			},
		},
	}
	return append(core, defaultReadingPassagesExtra()...)
}

func (s *SeedService) seedReadingPassages() error {
	passages := defaultReadingPassages()

	return s.DB.Transaction(func(tx *gorm.DB) error {
		for _, p := range passages {
			var count int64
			tx.Model(&models.ReadingPassage{}).
				Where("title = ?", p.Title).
				Count(&count)
			if count > 0 {
				continue
			}

			passage := models.ReadingPassage{
				Title:            p.Title,
				Level:            p.Level,
				Content:          p.Content,
				Summary:          p.Summary,
				Status:           models.ReadingStatusPublished,
				WordCount:        countReadingWords(p.Content),
				EstimatedMinutes: p.EstimatedMinutes,
				SortOrder:        p.SortOrder,
			}
			passage.SetCreateInfo("seed")
			if err := tx.Create(&passage).Error; err != nil {
				return err
			}

			for i, q := range p.Questions {
				opts, err := json.Marshal(q.Options)
				if err != nil {
					return err
				}
				qq := models.ReadingQuestion{
					PassageID:   passage.ID,
					Stem:        q.Stem,
					Options:     string(opts),
					Answer:      q.Answer,
					Explanation: q.Explanation,
					SortOrder:   i + 1,
				}
				qq.SetCreateInfo("seed")
				if err := tx.Create(&qq).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})
}

// SeedReadingPassages 导入阅读理解 seed（按标题去重）。
func (s *SeedService) SeedReadingPassages() error {
	return s.seedReadingPassages()
}
