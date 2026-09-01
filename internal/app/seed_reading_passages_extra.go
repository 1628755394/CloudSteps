package app

// defaultReadingPassagesExtra 阅读理解 seed 扩充篇目（#13–#50）。
// 短文为公共领域改编或原创 ESL 材料，仅供学习练习。
func defaultReadingPassagesExtra() []seedReadingPassage {
	return []seedReadingPassage{
		// ── 初阶 #13–#27 ──
		{
			Title: "My First Day at a New School", Level: "初阶",
			Summary: "转学第一天，Emma 从紧张到交到新朋友。",
			EstimatedMinutes: 4, SortOrder: 13,
			Content: `Emma moved to a new city with her family. On Monday, she walked into a classroom full of strangers. Her hands were sweaty and her heart beat fast.

A girl named Nina smiled and said, "You can sit next to me." During lunch, Nina introduced Emma to two other students. They talked about music and a school club.

By the end of the day, Emma felt less afraid. She learned that a friendly hello can turn a scary first day into a good memory.`,
			Questions: []seedReadingQuestion{
				{Stem: "How did Emma feel at the beginning?", Options: opts("Nervous and scared", "Angry and bored", "Sleepy and hungry", "Proud and loud"), Answer: "A", Explanation: "Her hands were sweaty and her heart beat fast。"},
				{Stem: "Who helped Emma on her first day?", Options: opts("A teacher only", "Nina", "Her brother", "The principal"), Answer: "B", Explanation: "A girl named Nina smiled and invited her to sit。"},
				{Stem: "What did Emma learn?", Options: opts("School is always easy", "A friendly hello can help", "Lunch is the hardest part", "Clubs are not fun"), Answer: "B", Explanation: "a friendly hello can turn a scary first day into a good memory。"},
			},
		},
		{
			Title: "Baking Cookies with Grandma", Level: "初阶",
			Summary: "跟奶奶学做曲奇，学会耐心与分享。",
			EstimatedMinutes: 4, SortOrder: 14,
			Content: `Every Sunday, Leo visits his grandma. This week they decided to bake chocolate cookies. Grandma measured the flour while Leo stirred the eggs and sugar.

"The dough needs to rest for ten minutes," Grandma said. Leo wanted to eat the cookies right away, but he waited. When the cookies came out of the oven, the kitchen smelled wonderful.

Leo shared the warm cookies with his neighbor. Grandma laughed and said, "Good food tastes better when you share it."`,
			Questions: []seedReadingQuestion{
				{Stem: "What did Leo and Grandma bake?", Options: opts("Bread", "Chocolate cookies", "Pizza", "Soup"), Answer: "B", Explanation: "they decided to bake chocolate cookies。"},
				{Stem: "Why did Leo wait?", Options: opts("The dough needed to rest", "The oven was broken", "They had no sugar", "Grandma was shopping"), Answer: "A", Explanation: "The dough needs to rest for ten minutes。"},
				{Stem: "Who received some cookies?", Options: opts("The mail carrier", "Leo's neighbor", "A stranger at the bus stop", "Leo's teacher"), Answer: "B", Explanation: "Leo shared the warm cookies with his neighbor。"},
			},
		},
		{
			Title: "The Boy Who Cried Wolf", Level: "初阶",
			Summary: "经典寓言：说谎的孩子最终无人相信。",
			EstimatedMinutes: 4, SortOrder: 15,
			Content: `A young shepherd watched sheep on a hill. One day he shouted, "Wolf! Wolf!" The villagers ran up with tools, but there was no wolf. The boy laughed at their worried faces.

He did the same trick again the next week. Again, the villagers came—and again, it was a joke. When a real wolf appeared one evening, the boy cried for help. This time nobody came. The wolf chased the sheep away.

The boy learned that if you lie too often, people will not trust you when you tell the truth.`,
			Questions: []seedReadingQuestion{
				{Stem: "What was the boy's job?", Options: opts("Fishing", "Watching sheep", "Selling fruit", "Teaching"), Answer: "B", Explanation: "A young shepherd watched sheep。"},
				{Stem: "Why did villagers stop coming?", Options: opts("They were too tired", "They did not hear him", "They thought he was lying again", "The road was closed"), Answer: "C", Explanation: "He had tricked them before, so they did not believe him。"},
				{Stem: "What is the moral of the story?", Options: opts("Wolves are friendly", "Lying destroys trust", "Sheep need fences", "Villages are dangerous"), Answer: "B", Explanation: "if you lie too often, people will not trust you。"},
			},
		},
		{
			Title: "The Lion and the Mouse", Level: "初阶",
			Summary: "狮子与老鼠：小善举也能有大回报。",
			EstimatedMinutes: 4, SortOrder: 16,
			Content: `A lion was sleeping in the forest when a little mouse ran across his nose. The lion woke up and caught the mouse in his huge paw.

"Please let me go," said the mouse. "One day I may help you." The lion laughed but set the mouse free. Later, hunters caught the lion in a net. The mouse chewed through the ropes until the lion could escape.

"You were right," said the lion quietly. "Even the smallest friend can save the strongest king."`,
			Questions: []seedReadingQuestion{
				{Stem: "How did the lion first react to the mouse?", Options: opts("He ignored it", "He caught it", "He ran away", "He shared food"), Answer: "B", Explanation: "The lion woke up and caught the mouse。"},
				{Stem: "How did the mouse help the lion?", Options: opts("By calling other animals", "By chewing the net ropes", "By fighting the hunters", "By digging a hole"), Answer: "B", Explanation: "The mouse chewed through the ropes。"},
				{Stem: "What lesson does the story teach?", Options: opts("Mice are stronger than lions", "Small kindness can matter", "Sleep is dangerous", "Hunters always win"), Answer: "B", Explanation: "Even the smallest friend can save the strongest king。"},
			},
		},
		{
			Title: "A Rainy Day Adventure", Level: "初阶",
			Summary: "雨天不能出门，兄妹在家发现阅读乐趣。",
			EstimatedMinutes: 4, SortOrder: 17,
			Content: `It rained all day on Saturday. Mia and her brother Ben could not play soccer outside. They complained until their mother brought out a box of old books from the attic.

One book had maps of imaginary islands. They read aloud, drew their own maps, and invented a treasure hunt in the living room. The rain sounded on the windows, but inside the house felt like an adventure.

When the sun came out at five o'clock, they still did not want to stop reading. Mia said, "Maybe rainy days are not so bad."`,
			Questions: []seedReadingQuestion{
				{Stem: "Why could Mia and Ben not play soccer?", Options: opts("They were sick", "It rained all day", "The ball was lost", "The field was far"), Answer: "B", Explanation: "It rained all day on Saturday。"},
				{Stem: "Where did the books come from?", Options: opts("The library", "The attic", "A bookstore", "School"), Answer: "B", Explanation: "a box of old books from the attic。"},
				{Stem: "How did Mia feel about rainy days at the end?", Options: opts("They are always terrible", "They might be okay", "They should cancel school", "They are too cold"), Answer: "B", Explanation: "Maybe rainy days are not so bad。"},
			},
		},
		{
			Title: "Learning to Ride a Bike", Level: "初阶",
			Summary: "Sam 学骑车摔了几次，最终在爸爸帮助下成功。",
			EstimatedMinutes: 4, SortOrder: 18,
			Content: `Sam received a blue bike for his birthday. On the first try, he fell into the grass and scraped his knee. He wanted to quit, but his father held the back of the seat and said, "Keep your eyes forward."

They practiced every evening after homework. Sam learned to balance, pedal, and brake slowly. On Friday, his father let go without telling him. Sam rode alone down the quiet street.

"I did it!" he shouted. His father clapped and said, "Falling is part of learning."`,
			Questions: []seedReadingQuestion{
				{Stem: "What happened on Sam's first try?", Options: opts("He rode perfectly", "He fell into the grass", "He lost the bike", "It started to snow"), Answer: "B", Explanation: "he fell into the grass and scraped his knee。"},
				{Stem: "When did Sam ride alone?", Options: opts("On Monday morning", "On Friday", "Never", "At midnight"), Answer: "B", Explanation: "On Friday, his father let go ... Sam rode alone。"},
				{Stem: "What did Sam's father say about falling?", Options: opts("It means you should stop", "It is part of learning", "It only happens once", "It is always dangerous"), Answer: "B", Explanation: "Falling is part of learning。"},
			},
		},
		{
			Title: "Visiting the Zoo", Level: "初阶",
			Summary: "动物园一日游，了解动物保护与习性。",
			EstimatedMinutes: 5, SortOrder: 19,
			Content: `Class 3B took a bus to the city zoo. The guide explained that many animals in the zoo were rescued or born in safe programs. They cannot return to the wild because they would not survive alone.

The students watched penguins swim and giraffes eat leaves from tall trees. A sign near the tiger said, "Do not tap the glass." The class learned that quiet observation is better than loud noise.

On the way home, the teacher asked each student to write one fact about an animal. Lily wrote, "Penguins are birds, but they cannot fly."`,
			Questions: []seedReadingQuestion{
				{Stem: "Why can some zoo animals not return to the wild?", Options: opts("They are too colorful", "They would not survive alone", "The wild is too close", "They dislike other animals"), Answer: "B", Explanation: "they would not survive alone。"},
				{Stem: "What did the sign near the tiger say?", Options: opts("Feed the tiger", "Do not tap the glass", "Take photos only", "Run quickly"), Answer: "B", Explanation: "Do not tap the glass。"},
				{Stem: "What fact did Lily write?", Options: opts("Tigers can swim", "Penguins cannot fly", "Giraffes are fish", "Buses are fast"), Answer: "B", Explanation: "Penguins are birds, but they cannot fly。"},
			},
		},
		{
			Title: "Making Friends at Summer Camp", Level: "初阶",
			Summary: "夏令营里 shy 的 Jake 通过团队合作交到朋友。",
			EstimatedMinutes: 4, SortOrder: 20,
			Content: `Jake was shy at summer camp. During the first game, he stood at the back and barely spoke. On Wednesday, his team had to build a raft from plastic bottles and tape.

Jake suggested tying the bottles in two layers for strength. His idea worked, and the raft floated across the pool. Teammates cheered and asked him to join their table at dinner.

By the last day, Jake had three new friends and a photo of their winning raft. He realized that sharing ideas is easier than he thought.`,
			Questions: []seedReadingQuestion{
				{Stem: "How did Jake behave at first?", Options: opts("He talked loudly", "He was shy and quiet", "He led every game", "He left camp early"), Answer: "B", Explanation: "Jake was shy ... barely spoke。"},
				{Stem: "What did Jake's team build?", Options: opts("A tree house", "A raft from bottles", "A robot", "A campfire"), Answer: "B", Explanation: "build a raft from plastic bottles and tape。"},
				{Stem: "What did Jake realize?", Options: opts("Camp is boring", "Sharing ideas can be easier than he thought", "Rafts always sink", "Photos are useless"), Answer: "B", Explanation: "sharing ideas is easier than he thought。"},
			},
		},
		{
			Title: "The North Wind and the Sun", Level: "初阶",
			Summary: "北风和太阳比试：温和往往比强迫更有效。",
			EstimatedMinutes: 4, SortOrder: 21,
			Content: `The North Wind and the Sun argued about who was stronger. They saw a traveler wearing a thick coat. "Whoever makes him take off the coat wins," said the Sun.

The North Wind blew hard. The traveler pulled the coat tighter. Then the Sun shone gently and warmly. The traveler soon felt hot and removed the coat himself.

The Sun smiled. "Gentle warmth works better than force."`,
			Questions: []seedReadingQuestion{
				{Stem: "What were the North Wind and the Sun arguing about?", Options: opts("Who was stronger", "Who was taller", "Which season is best", "Where to travel"), Answer: "A", Explanation: "argued about who was stronger。"},
				{Stem: "What did the traveler do when the wind blew hard?", Options: opts("He took off the coat", "He pulled the coat tighter", "He ran away", "He slept"), Answer: "B", Explanation: "The traveler pulled the coat tighter。"},
				{Stem: "Who won the argument?", Options: opts("The North Wind", "The Sun", "The traveler", "Nobody"), Answer: "B", Explanation: "The Sun shone gently ... traveler removed the coat。"},
			},
		},
		{
			Title: "Saving a Stray Cat", Level: "初阶",
			Summary: "邻居们合力救助流浪猫并帮它找到家。",
			EstimatedMinutes: 4, SortOrder: 22,
			Content: `A thin gray cat appeared behind the apartment building. It meowed softly but ran away when people came close. An elderly woman named Mrs. Chen left water and dry food on the stairs.

Two children made a small shelter from a cardboard box and an old blanket. A vet from the neighborhood checked the cat for free and found a microchip. The owner lived three streets away and had been searching for weeks.

When the cat went home, the whole building felt proud. Mrs. Chen said, "Kindness does not need a big budget."`,
			Questions: []seedReadingQuestion{
				{Stem: "What did Mrs. Chen leave for the cat?", Options: opts("Toys and milk", "Water and dry food", "A new collar", "Fish from a restaurant"), Answer: "B", Explanation: "left water and dry food on the stairs。"},
				{Stem: "How was the owner found?", Options: opts("Through a microchip", "Through a TV ad", "The cat spoke", "By guessing"), Answer: "A", Explanation: "found a microchip ... owner lived three streets away。"},
				{Stem: "What did Mrs. Chen say about kindness?", Options: opts("It needs a big budget", "It does not need a big budget", "Only vets can help", "Cats should stay outside"), Answer: "B", Explanation: "Kindness does not need a big budget。"},
			},
		},
		{
			Title: "Our Class Field Trip", Level: "初阶",
			Summary: "参观科学博物馆，激发对太空的兴趣。",
			EstimatedMinutes: 5, SortOrder: 23,
			Content: `Our class visited the science museum on Thursday. We saw a model of the solar system and touched a real meteorite behind glass. The guide said the meteorite was older than any building in our city.

In the planetarium, stars moved across the dark ceiling. My friend Ana whispered, "I want to study space one day." Our homework was to draw one thing we learned.

I drew Jupiter with its red spot and wrote three facts on the back of the paper.`,
			Questions: []seedReadingQuestion{
				{Stem: "What could students touch?", Options: opts("A live snake", "A meteorite behind glass", "The sun model", "Moon rocks freely"), Answer: "B", Explanation: "touched a real meteorite behind glass。"},
				{Stem: "What did Ana want to study?", Options: opts("Cooking", "Space", "History only", "Sports medicine"), Answer: "B", Explanation: "I want to study space one day。"},
				{Stem: "What planet did the writer draw?", Options: opts("Mars", "Jupiter", "Earth", "Venus"), Answer: "B", Explanation: "I drew Jupiter with its red spot。"},
			},
		},
		{
			Title: "A Letter to My Pen Pal", Level: "初阶",
			Summary: "笔友通信了解不同国家的学校生活。",
			EstimatedMinutes: 4, SortOrder: 24,
			Content: `Dear Sofia,

I am writing from Canada. At my school we start at eight thirty and finish at three. In winter we sometimes have snow days when classes are canceled.

You wrote that your school in Brazil starts earlier and ends at noon because of the heat. I think that is interesting. Do you play football after school?

Please tell me about your favorite subject. Mine is art because I like drawing animals.

Your friend,
Ryan`,
			Questions: []seedReadingQuestion{
				{Stem: "Where is Ryan from?", Options: opts("Brazil", "Canada", "Japan", "France"), Answer: "B", Explanation: "I am writing from Canada。"},
				{Stem: "Why does Sofia's school end at noon?", Options: opts("Because of the heat", "Because of snow", "Because of holidays", "Because of exams"), Answer: "A", Explanation: "ends at noon because of the heat。"},
				{Stem: "What is Ryan's favorite subject?", Options: opts("Math", "Art", "History", "PE"), Answer: "B", Explanation: "Mine is art because I like drawing animals。"},
			},
		},
		{
			Title: "Cleaning My Room", Level: "初阶",
			Summary: "整理房间找到丢失物品，养成整洁习惯。",
			EstimatedMinutes: 4, SortOrder: 25,
			Content: `Kate's room was messy. Books, socks, and papers covered the floor. Her mother said, "You cannot invite friends until it is clean."

Kate sorted clothes into a laundry basket and put books back on the shelf. Under the bed she found her missing math notebook and a birthday gift she forgot to open.

When the room was tidy, Kate felt calm and proud. She promised to spend ten minutes each evening keeping things in order.`,
			Questions: []seedReadingQuestion{
				{Stem: "Why did Kate need to clean her room?", Options: opts("To invite friends", "To sell her books", "To move house", "For a photo contest"), Answer: "A", Explanation: "You cannot invite friends until it is clean。"},
				{Stem: "What did Kate find under the bed?", Options: opts("A gold coin", "Her math notebook", "A pet hamster", "A new phone"), Answer: "B", Explanation: "found her missing math notebook。"},
				{Stem: "What habit did Kate promise?", Options: opts("Never read again", "Ten minutes each evening to stay tidy", "Sleep on the floor", "Buy more socks"), Answer: "B", Explanation: "spend ten minutes each evening keeping things in order。"},
			},
		},
		{
			Title: "The Crow and the Pitcher", Level: "初阶",
			Summary: "聪明的乌鸦用石子喝到了瓶底的水。",
			EstimatedMinutes: 4, SortOrder: 26,
			Content: `On a hot day, a thirsty crow found a pitcher with a little water at the bottom. Its beak could not reach the water. The crow tried to tip the pitcher over, but it was too heavy.

Then the crow dropped small stones into the pitcher one by one. The water rose slowly until the crow could drink. Refreshed, it flew to a shady tree.

The story shows that patience and clever thinking can solve difficult problems.`,
			Questions: []seedReadingQuestion{
				{Stem: "What was the crow's problem?", Options: opts("No food", "Water was too low to reach", "The pitcher was empty", "It was raining"), Answer: "B", Explanation: "Its beak could not reach the water。"},
				{Stem: "What did the crow put into the pitcher?", Options: opts("Stones", "Leaves", "Coins", "Ice"), Answer: "A", Explanation: "dropped small stones into the pitcher。"},
				{Stem: "What does the story show?", Options: opts("Birds dislike water", "Clever thinking can help", "Pitchers are useless", "Hot days are rare"), Answer: "B", Explanation: "patience and clever thinking can solve difficult problems。"},
			},
		},
		{
			Title: "My Favorite Season", Level: "初阶",
			Summary: "四个同学讨论各自最喜欢的季节。",
			EstimatedMinutes: 4, SortOrder: 27,
			Content: `In English class, four students described their favorite seasons. Amy loves spring because flowers bloom and the air feels fresh. Ben prefers summer for swimming and long daylight.

Carlos chose autumn. He likes the color of falling leaves and the taste of hot apple juice. Diana said winter is best because she can ski with her cousins in the mountains.

The teacher smiled and said, "Every season gives us something special if we pay attention."`,
			Questions: []seedReadingQuestion{
				{Stem: "Why does Amy like spring?", Options: opts("For skiing", "For flowers and fresh air", "For swimming", "For apple juice"), Answer: "B", Explanation: "flowers bloom and the air feels fresh。"},
				{Stem: "Which season does Carlos prefer?", Options: opts("Spring", "Summer", "Autumn", "Winter"), Answer: "C", Explanation: "Carlos chose autumn。"},
				{Stem: "What can Diana do in winter?", Options: opts("Swim in the sea", "Ski with her cousins", "Pick apples", "Plant flowers"), Answer: "B", Explanation: "she can ski with her cousins。"},
			},
		},

		// ── 中阶 #28–#40 ──
		{
			Title: "The Invention of the Telephone", Level: "中阶",
			Summary: "贝尔与电话发明：沟通方式如何改变社会。",
			EstimatedMinutes: 6, SortOrder: 28,
			Content: `In the 1870s, Alexander Graham Bell experimented with transmitting voice over wires. He was not alone—other inventors were racing toward the same goal. On March 10, 1876, Bell succeeded in calling his assistant in the next room: "Mr. Watson, come here."

The telephone spread quickly in cities, connecting families and businesses across distance. Critics worried that constant calls would destroy quiet life. Supporters argued that faster communication would save lives during emergencies and strengthen commerce.

Today smartphones carry Bell's basic idea further, but the principle remains: turning sound into signals that travel far and return as human voice.`,
			Questions: []seedReadingQuestion{
				{Stem: "When did Bell succeed in transmitting voice?", Options: opts("1876", "1900", "1850", "1925"), Answer: "A", Explanation: "On March 10, 1876, Bell succeeded。"},
				{Stem: "What did critics worry about?", Options: opts("Phones would be too cheap", "Constant calls would destroy quiet life", "Wires would melt", "Assistants would quit"), Answer: "B", Explanation: "Critics worried that constant calls would destroy quiet life。"},
				{Stem: "What principle do modern smartphones still follow?", Options: opts("Turning sound into traveling signals", "Using only written mail", "Avoiding all wires", "Blocking emergencies"), Answer: "A", Explanation: "turning sound into signals that travel far。"},
			},
		},
		{
			Title: "Why We Need to Drink Water", Level: "中阶",
			Summary: "水对人体的作用与日常补水建议。",
			EstimatedMinutes: 5, SortOrder: 29,
			Content: `Water makes up a large part of the human body. It helps transport nutrients, regulate temperature, and remove waste through sweat and urine. Even mild dehydration can cause headaches, tiredness, and poor concentration.

Doctors generally recommend drinking water regularly throughout the day rather than waiting until you feel extremely thirsty. Needs vary with age, activity, and climate. Athletes and people in hot regions require more fluids.

Sweet drinks may taste good, but plain water remains the healthiest choice for daily hydration. Carrying a reusable bottle is a simple habit that supports both health and the environment.`,
			Questions: []seedReadingQuestion{
				{Stem: "Which is NOT mentioned as a function of water?", Options: opts("Regulating temperature", "Removing waste", "Producing electricity", "Transporting nutrients"), Answer: "C", Explanation: "文中未提到产生电力。"},
				{Stem: "What can mild dehydration cause?", Options: opts("Better memory", "Headaches and tiredness", "Stronger bones", "Faster running only"), Answer: "B", Explanation: "mild dehydration can cause headaches, tiredness。"},
				{Stem: "What habit supports health and the environment?", Options: opts("Using a reusable bottle", "Drinking only soda", "Avoiding all liquids", "Boiling all rain"), Answer: "A", Explanation: "Carrying a reusable bottle ... supports both health and the environment。"},
			},
		},
		{
			Title: "Social Media and Teenagers", Level: "中阶",
			Summary: "社交媒体对青少年的利弊与理性使用。",
			EstimatedMinutes: 6, SortOrder: 30,
			Content: `Social media helps teenagers stay connected with friends, discover hobbies, and express creativity. A photography club, for example, can share work instantly with supporters around the world.

However, constant comparison with edited photos can harm self-esteem. Sleep also suffers when teens scroll late at night. Schools and parents increasingly teach "digital balance": set time limits, verify news sources, and remember that online profiles rarely show full reality.

Used thoughtfully, social media can support learning and friendship. Used without limits, it can become a source of stress.`,
			Questions: []seedReadingQuestion{
				{Stem: "What is one benefit mentioned?", Options: opts("Guaranteed higher grades", "Staying connected and sharing creativity", "No need for sleep", "Replacing all classes"), Answer: "B", Explanation: "stay connected ... express creativity。"},
				{Stem: "What harm can constant comparison cause?", Options: opts("Better eyesight", "Lower self-esteem", "More free time", "Stronger muscles"), Answer: "B", Explanation: "constant comparison ... can harm self-esteem。"},
				{Stem: "What does \"digital balance\" include?", Options: opts("Scrolling all night", "Setting time limits", "Believing every post", "Avoiding all technology forever"), Answer: "B", Explanation: "set time limits, verify news sources。"},
			},
		},
		{
			Title: "The Benefits of Team Sports", Level: "中阶",
			Summary: "团队运动如何培养合作、纪律与抗挫力。",
			EstimatedMinutes: 5, SortOrder: 31,
			Content: `Team sports such as basketball, volleyball, and soccer teach skills that classrooms alone cannot provide. Players learn to communicate under pressure, trust teammates, and accept both victory and defeat with respect.

Regular training also improves physical health, sleep quality, and stress management. Coaches often emphasize discipline—arriving on time, warming up properly, and following fair rules.

Research suggests that students who participate in organized sports may develop stronger time-management habits because they must balance practice with homework. The goal is not only to win games but to build character.`,
			Questions: []seedReadingQuestion{
				{Stem: "What do players learn under pressure?", Options: opts("To ignore teammates", "To communicate and trust others", "To break rules", "To skip homework"), Answer: "B", Explanation: "learn to communicate under pressure, trust teammates。"},
				{Stem: "What do coaches often emphasize?", Options: opts("Winning at any cost", "Discipline and fair rules", "Avoiding warm-ups", "Playing alone"), Answer: "B", Explanation: "Coaches often emphasize discipline ... following fair rules。"},
				{Stem: "What balance must student athletes manage?", Options: opts("Practice and homework", "Only video games", "Sleep and television", "Food and fashion"), Answer: "A", Explanation: "balance practice with homework。"},
			},
		},
		{
			Title: "A Trip to Japan", Level: "中阶",
			Summary: "旅行见闻：礼仪、交通与饮食文化体验。",
			EstimatedMinutes: 6, SortOrder: 32,
			Content: `Last spring, Maria spent two weeks in Japan. She noticed that people bow slightly when greeting and that trains arrive on schedule to the minute. In Kyoto she visited temples where visitors speak softly and remove shoes before entering certain rooms.

Maria tried sushi, ramen, and matcha tea. She was surprised that many restaurants display plastic models of dishes in the window so tourists can choose easily. She also learned to sort trash carefully, because recycling rules are strict in many cities.

"The country felt modern and traditional at the same time," she wrote in her journal.`,
			Questions: []seedReadingQuestion{
				{Stem: "What did Maria notice about trains?", Options: opts("They are always late", "They arrive on schedule", "They are only for tourists", "They do not exist in Kyoto"), Answer: "B", Explanation: "trains arrive on schedule to the minute。"},
				{Stem: "Why do restaurants show plastic food models?", Options: opts("To decorate walls", "To help customers choose dishes", "To replace real meals", "To train chefs"), Answer: "B", Explanation: "display plastic models ... so tourists can choose easily。"},
				{Stem: "How did Japan feel to Maria?", Options: opts("Only modern", "Only traditional", "Modern and traditional at once", "Empty and silent"), Answer: "C", Explanation: "modern and traditional at the same time。"},
			},
		},
		{
			Title: "Climate Change Basics", Level: "中阶",
			Summary: "温室效应、极端天气与个人可做的减排行动。",
			EstimatedMinutes: 6, SortOrder: 33,
			Content: `Earth's climate has always changed naturally, but scientists observe that recent warming is unusually fast. Burning coal, oil, and gas releases greenhouse gases that trap heat in the atmosphere. Effects include rising sea levels, stronger storms, and shifting farming seasons.

No single person can reverse global trends alone, yet daily choices matter: using public transport, reducing food waste, and choosing efficient appliances lower individual carbon footprints. Governments and companies must also invest in renewable energy and protect forests.

Understanding climate change is the first step toward informed action rather than fear or denial.`,
			Questions: []seedReadingQuestion{
				{Stem: "What releases greenhouse gases according to the passage?", Options: opts("Planting trees", "Burning coal, oil, and gas", "Using bicycles", "Reading books"), Answer: "B", Explanation: "Burning coal, oil, and gas releases greenhouse gases。"},
				{Stem: "Which effect is mentioned?", Options: opts("Rising sea levels", "More moons", "Colder deserts only", "Fewer languages"), Answer: "A", Explanation: "Effects include rising sea levels。"},
				{Stem: "What is described as the first step?", Options: opts("Ignoring news", "Understanding the issue", "Stopping all travel forever", "Building more coal plants"), Answer: "B", Explanation: "Understanding climate change is the first step。"},
			},
		},
		{
			Title: "How Vaccines Work", Level: "中阶",
			Summary: "疫苗如何训练免疫系统识别病原体。",
			EstimatedMinutes: 6, SortOrder: 34,
			Content: `Vaccines prepare the immune system to fight diseases without causing full illness. They often contain weakened viruses, inactive bacteria, or pieces of proteins that teach white blood cells to recognize invaders.

After vaccination, the body remembers the pathogen. If exposure happens later, defenses activate faster, reducing severe sickness and spread within communities. This "herd protection" helps people who cannot be vaccinated for medical reasons.

Vaccine development requires careful testing for safety and effectiveness. Side effects are usually mild, such as a sore arm or low fever, compared with the risks of the disease itself.`,
			Questions: []seedReadingQuestion{
				{Stem: "What do vaccines teach the body to do?", Options: opts("Ignore all germs", "Recognize and fight pathogens", "Stop eating protein", "Avoid white blood cells"), Answer: "B", Explanation: "teach white blood cells to recognize invaders。"},
				{Stem: "What is \"herd protection\"?", Options: opts("Only animals get vaccines", "Community-wide reduced spread", "A type of farm medicine", "Sleeping in groups"), Answer: "B", Explanation: "reducing severe sickness and spread within communities。"},
				{Stem: "How are side effects described?", Options: opts("Always deadly", "Usually mild", "Never recorded", "Worse than any disease always"), Answer: "B", Explanation: "Side effects are usually mild。"},
			},
		},
		{
			Title: "The Story of the Internet", Level: "中阶",
			Summary: "从 ARPANET 到全球互联网的信息革命。",
			EstimatedMinutes: 6, SortOrder: 35,
			Content: `The Internet began as ARPANET, a U.S. research network designed to share data between universities and defense labs in the 1960s and 70s. Its key innovation was packet switching—breaking messages into small pieces that could travel by different routes and reassemble at the destination.

In the 1990s, the World Wide Web made the network accessible to the public through browsers and hyperlinks. Email, online shopping, and streaming later transformed daily life. Today billions of devices connect through fiber cables, satellites, and mobile towers.

With great connectivity comes responsibility: privacy, cybersecurity, and equal access remain ongoing challenges.`,
			Questions: []seedReadingQuestion{
				{Stem: "What was ARPANET designed for?", Options: opts("Selling music", "Sharing research data", "Printing newspapers", "Mining gold"), Answer: "B", Explanation: "designed to share data between universities and defense labs。"},
				{Stem: "What is packet switching?", Options: opts("Sending messages in small reassembled pieces", "Using only one cable", "Blocking all routes", "Printing packets on paper"), Answer: "A", Explanation: "breaking messages into small pieces ... reassemble at the destination。"},
				{Stem: "Which challenge is mentioned today?", Options: opts("Privacy and cybersecurity", "Too few devices", "No mobile towers", "Lack of email"), Answer: "A", Explanation: "privacy, cybersecurity, and equal access remain ongoing challenges。"},
			},
		},
		{
			Title: "Mindfulness for Students", Level: "中阶",
			Summary: "正念练习如何帮助缓解考试焦虑。",
			EstimatedMinutes: 5, SortOrder: 36,
			Content: `Mindfulness means paying attention to the present moment without harsh judgment. For students facing exams, a few minutes of slow breathing can lower heart rate and clear racing thoughts.

A simple exercise: sit comfortably, notice the feeling of air entering and leaving the nose, and when the mind wanders to worries, gently return focus to breath. Schools in several countries now offer short mindfulness sessions before tests.

Research indicates that regular practice may improve emotional regulation, though it is not a replacement for study planning or professional mental-health support when needed.`,
			Questions: []seedReadingQuestion{
				{Stem: "What does mindfulness mean?", Options: opts("Ignoring the future", "Paying attention to the present without harsh judgment", "Sleeping during class", "Memorizing faster"), Answer: "B", Explanation: "paying attention to the present moment without harsh judgment。"},
				{Stem: "What should students do when the mind wanders?", Options: opts("Stop breathing", "Return focus to breath", "Leave the room", "Start shouting"), Answer: "B", Explanation: "gently return focus to breath。"},
				{Stem: "What is mindfulness NOT a replacement for?", Options: opts("Breathing", "Study planning and professional support when needed", "Sitting", "School buildings"), Answer: "B", Explanation: "not a replacement for study planning or professional mental-health support。"},
			},
		},
		{
			Title: "Electric Cars and the Future", Level: "中阶",
			Summary: "电动汽车的优势、充电基础设施与挑战。",
			EstimatedMinutes: 6, SortOrder: 37,
			Content: `Electric vehicles (EVs) run on batteries instead of gasoline, producing zero tailpipe emissions in daily use. They are quiet, accelerate smoothly, and can be charged at home or public stations.

Challenges remain. Batteries require minerals such as lithium, and mining must be managed responsibly. Charging networks are still uneven in rural areas, and cold weather can reduce range. Engineers work on faster chargers and recycling programs for old packs.

Many governments offer incentives to buyers while setting future dates to phase out new gasoline cars. The transition will take years but could improve urban air quality significantly.`,
			Questions: []seedReadingQuestion{
				{Stem: "What do EVs produce at the tailpipe during daily use?", Options: opts("Zero emissions", "More smoke than trucks", "Only water steam always", "Gasoline vapor"), Answer: "A", Explanation: "producing zero tailpipe emissions in daily use。"},
				{Stem: "Which challenge is mentioned?", Options: opts("Uneven charging in rural areas", "Too many horses", "No need for minerals", "Engines getting louder"), Answer: "A", Explanation: "Charging networks are still uneven in rural areas。"},
				{Stem: "What might improve with wider EV adoption?", Options: opts("Urban air quality", "Coal mining", "Traffic jams only", "Oil spills at sea always"), Answer: "A", Explanation: "could improve urban air quality significantly。"},
			},
		},
		{
			Title: "The Importance of Biodiversity", Level: "中阶",
			Summary: "生物多样性与生态系统稳定、人类生存的关系。",
			EstimatedMinutes: 6, SortOrder: 38,
			Content: `Biodiversity refers to the variety of life—genes, species, and ecosystems—on Earth. Forests, wetlands, and coral reefs provide clean water, pollination for crops, and raw materials for medicine. When species disappear, food webs weaken and ecosystems become less resilient to drought or disease.

Human activities such as deforestation, pollution, and overfishing accelerate loss. Protected areas and sustainable farming can slow the trend. Indigenous communities often hold valuable knowledge about local plants and animals.

Protecting biodiversity is not only about saving rare animals; it is about maintaining the systems that support human survival.`,
			Questions: []seedReadingQuestion{
				{Stem: "What does biodiversity include?", Options: opts("Only zoo animals", "Genes, species, and ecosystems", "City buildings", "Internet servers"), Answer: "B", Explanation: "the variety of life—genes, species, and ecosystems。"},
				{Stem: "What happens when species disappear?", Options: opts("Food webs weaken", "Rain increases everywhere", "All deserts vanish", "Oceans become fresh"), Answer: "A", Explanation: "When species disappear, food webs weaken。"},
				{Stem: "Why is protecting biodiversity important for humans?", Options: opts("It maintains systems that support survival", "It removes all farming", "It stops all medicine", "It ends pollution instantly"), Answer: "A", Explanation: "maintaining the systems that support human survival。"},
			},
		},
		{
			Title: "Working as a Volunteer", Level: "中阶",
			Summary: "志愿者经历带来的技能与社会联结。",
			EstimatedMinutes: 5, SortOrder: 39,
			Content: `Volunteering means giving time and skills without expecting payment. Students may tutor younger children, plant trees, or help at food banks. Employers and universities often value volunteer experience because it shows initiative and empathy.

For the volunteer, benefits include new friendships, practical skills, and a broader view of community needs. A medical student who translates at a clinic, for example, learns communication under real pressure.

The key is reliability: organizations depend on people who show up consistently and respect those they serve.`,
			Questions: []seedReadingQuestion{
				{Stem: "What is volunteering?", Options: opts("Paid overtime work", "Giving time without expecting payment", "Mandatory military service", "Online gaming"), Answer: "B", Explanation: "giving time and skills without expecting payment。"},
				{Stem: "Why do employers value volunteer experience?", Options: opts("It shows initiative and empathy", "It replaces all degrees", "It guarantees wealth", "It avoids teamwork"), Answer: "A", Explanation: "shows initiative and empathy。"},
				{Stem: "What quality do organizations need most?", Options: opts("Reliability", "Expensive clothes", "Perfect grades only", "Silence"), Answer: "A", Explanation: "organizations depend on people who show up consistently。"},
			},
		},
		{
			Title: "The History of the Olympic Games", Level: "中阶",
			Summary: "古代奥运到现代奥运会的演变与价值。",
			EstimatedMinutes: 6, SortOrder: 40,
			Content: `The ancient Olympic Games began in Greece around 776 BCE, honoring the god Zeus with foot races, wrestling, and chariot events. Only free Greek men competed, and wars briefly paused to allow safe travel to Olympia.

The modern Olympics revived in 1896 in Athens, growing into a global festival with winter and summer editions. Today athletes from most nations compete under ideals of excellence, friendship, and respect. The event also faces controversies over cost, politics, and doping.

Despite debates, the Games remain a powerful symbol of human effort across cultures.`,
			Questions: []seedReadingQuestion{
				{Stem: "Where did the ancient Olympics begin?", Options: opts("Greece", "China", "Brazil", "Canada"), Answer: "A", Explanation: "began in Greece around 776 BCE。"},
				{Stem: "When were the modern Olympics revived?", Options: opts("1896", "1776", "2008", "1500"), Answer: "A", Explanation: "revived in 1896 in Athens。"},
				{Stem: "Which ideal is mentioned?", Options: opts("Friendship and respect", "Winning at any cost", "Avoiding all nations", "Replacing school"), Answer: "A", Explanation: "ideals of excellence, friendship, and respect。"},
			},
		},

		// ── 高阶 #41–#50 ──
		{
			Title: "The Ethics of Gene Editing", Level: "高阶",
			Summary: "CRISPR 等技术带来的医学希望与伦理边界。",
			EstimatedMinutes: 7, SortOrder: 41,
			Content: `Gene-editing tools such as CRISPR allow scientists to modify DNA with unprecedented precision. Potential benefits include treating inherited disorders like sickle-cell disease and developing crops that resist drought.

Ethical debates intensify when edits could affect future generations through germline changes—altering eggs, sperm, or embryos so traits pass to children. Critics warn of "designer babies," unfair access, and unforeseen ecological effects. Many countries ban germline editing for reproduction while permitting research under strict review.

The central question is not whether technology will advance, but how societies govern its use to maximize healing and minimize harm.`,
			Questions: []seedReadingQuestion{
				{Stem: "What is one potential benefit of gene editing?", Options: opts("Treating inherited disorders", "Eliminating all hospitals", "Stopping science forever", "Creating unlimited oil"), Answer: "A", Explanation: "treating inherited disorders like sickle-cell disease。"},
				{Stem: "Why are germline edits controversial?", Options: opts("They affect future generations", "They only change hair color temporarily", "They require no review", "They always fail"), Answer: "A", Explanation: "traits pass to children ... affect future generations。"},
				{Stem: "What is the central question according to the author?", Options: opts("How societies govern use of the technology", "Whether DNA exists", "How to ban all medicine", "Who will win sports"), Answer: "A", Explanation: "how societies govern its use to maximize healing and minimize harm。"},
			},
		},
		{
			Title: "Globalization and Local Culture", Level: "高阶",
			Summary: "全球化如何既传播文化也威胁地方多样性。",
			EstimatedMinutes: 7, SortOrder: 42,
			Content: `Globalization connects markets, media, and migration across borders. A teenager in Nairobi can stream the same song as a listener in Seoul within seconds. Multinational brands and English dominate many international forums.

Yet local languages, crafts, and festivals face pressure when global products are cheaper and louder. Some communities respond by documenting oral histories, teaching minority languages in schools, and promoting cultural tourism that respects tradition rather than mocking it.

Balanced globalization preserves exchange without reducing every place to the same shopping street.`,
			Questions: []seedReadingQuestion{
				{Stem: "What example shows global media connection?", Options: opts("A song streamed in Nairobi and Seoul", "Only local radio exists", "Books cannot travel", "Mail takes years"), Answer: "A", Explanation: "stream the same song ... within seconds。"},
				{Stem: "What pressure do local cultures face?", Options: opts("Cheaper global products dominating", "Too many local festivals", "Complete isolation", "No internet access ever"), Answer: "A", Explanation: "global products are cheaper and louder。"},
				{Stem: "What does balanced globalization aim to avoid?", Options: opts("Every place looking identical", "All trade", "All education", "All music"), Answer: "A", Explanation: "without reducing every place to the same shopping street。"},
			},
		},
		{
			Title: "The Psychology of Procrastination", Level: "高阶",
			Summary: "拖延的心理机制与实用应对策略。",
			EstimatedMinutes: 7, SortOrder: 43,
			Content: `Procrastination is not simply laziness. Psychologists link delay to fear of failure, perfectionism, and tasks that feel vague or unpleasant. The brain prefers immediate comfort—checking messages—over long-term rewards such as finishing a report.

Effective strategies include breaking work into small steps, setting clear deadlines, and removing distractions from the workspace. Self-compassion also helps: harsh self-criticism often increases avoidance rather than action.

Understanding emotional triggers allows people to design better habits instead of relying on willpower alone.`,
			Questions: []seedReadingQuestion{
				{Stem: "Which factor is linked to procrastination?", Options: opts("Fear of failure", "Too much free time only", "Perfect memory", "Lack of phones"), Answer: "A", Explanation: "delay to fear of failure, perfectionism。"},
				{Stem: "Why does the brain prefer checking messages?", Options: opts("Immediate comfort", "Long-term rewards", "Physical exercise", "Group exams"), Answer: "A", Explanation: "The brain prefers immediate comfort。"},
				{Stem: "What does self-compassion help reduce?", Options: opts("Avoidance caused by harsh self-criticism", "All deadlines", "Need for sleep", "Team projects"), Answer: "A", Explanation: "harsh self-criticism often increases avoidance。"},
			},
		},
		{
			Title: "Renewable Energy Transition", Level: "高阶",
			Summary: "能源转型中的技术、电网与就业结构变化。",
			EstimatedMinutes: 7, SortOrder: 44,
			Content: `Moving from fossil fuels to renewables such as wind, solar, and hydro power is central to climate policy. Costs of solar panels have fallen sharply over two decades, making clean electricity competitive in many regions.

Transition is not automatic. Grids must store intermittent energy through batteries or pumped hydro. Workers in coal regions need retraining and economic alternatives. International cooperation matters because supply chains for turbines and minerals span continents.

A successful shift balances environmental targets with fairness for communities that depend on old industries.`,
			Questions: []seedReadingQuestion{
				{Stem: "What has happened to solar panel costs?", Options: opts("They have fallen sharply", "They tripled every year", "They became illegal", "They are unchanged since 1900"), Answer: "A", Explanation: "Costs of solar panels have fallen sharply。"},
				{Stem: "Why is grid storage needed?", Options: opts("Wind and solar are intermittent", "Coal never runs out", "Hydro power is constant everywhere", "Batteries are decorative"), Answer: "A", Explanation: "Grids must store intermittent energy。"},
				{Stem: "What must be balanced in a successful shift?", Options: opts("Environmental targets and fairness for affected communities", "Speed and secrecy only", "Profit and pollution", "Sports and music"), Answer: "A", Explanation: "balances environmental targets with fairness。"},
			},
		},
		{
			Title: "Freedom of Speech in the Digital Age", Level: "高阶",
			Summary: "线上表达自由与内容审核、虚假信息之间的张力。",
			EstimatedMinutes: 7, SortOrder: 45,
			Content: `Freedom of speech protects individuals from government censorship, but platforms also moderate content to limit harassment, violence, and false health claims. The line between protection and overreach is contested in courts and public debate.

Algorithms amplify emotional posts, sometimes spreading misinformation faster than fact-checks can respond. Educators emphasize media literacy: verifying sources, recognizing bias, and distinguishing opinion from evidence.

Democratic societies seek rules that preserve open debate while reducing harm—a balance complicated by global audiences and anonymous accounts.`,
			Questions: []seedReadingQuestion{
				{Stem: "What do platforms moderate besides government?", Options: opts("Harassment and false health claims", "All homework", "Physical mail", "Weather only"), Answer: "A", Explanation: "moderate content to limit harassment ... false health claims。"},
				{Stem: "What can algorithms amplify?", Options: opts("Emotional posts including misinformation", "Only peer-reviewed journals", "Silent pages", "Printed books only"), Answer: "A", Explanation: "Algorithms amplify emotional posts, sometimes spreading misinformation。"},
				{Stem: "What do educators emphasize?", Options: opts("Media literacy", "Avoiding all news forever", "Copying any headline", "Deleting the internet"), Answer: "A", Explanation: "Educators emphasize media literacy。"},
			},
		},
		{
			Title: "The Role of Museums in Society", Level: "高阶",
			Summary: "博物馆作为教育、记忆与公共对话的空间。",
			EstimatedMinutes: 7, SortOrder: 46,
			Content: `Museums preserve artifacts, art, and scientific specimens while interpreting them for the public. Beyond display cases, they host school programs, temporary exhibitions, and community forums on history and science.

Recent debates ask who decides which stories are told. Former colonial powers face calls to return objects taken without consent. Digital archives expand access but raise questions about ownership of scans and photographs.

Well-run museums invite critical thinking rather than passive admiration, connecting past events to present choices.`,
			Questions: []seedReadingQuestion{
				{Stem: "What do museums do besides displaying objects?", Options: opts("Host programs and forums", "Only sell tickets", "Replace all schools", "Ban photography always"), Answer: "A", Explanation: "host school programs, temporary exhibitions, and community forums。"},
				{Stem: "What debate involves former colonial powers?", Options: opts("Returning objects taken without consent", "Building more malls", "Closing all libraries", "Ending all art"), Answer: "A", Explanation: "calls to return objects taken without consent。"},
				{Stem: "What do well-run museums invite?", Options: opts("Critical thinking", "Passive admiration only", "Political silence always", "No visitors"), Answer: "A", Explanation: "invite critical thinking rather than passive admiration。"},
			},
		},
		{
			Title: "Microplastics in the Food Chain", Level: "高阶",
			Summary: "微塑料的来源、检测与潜在健康风险研究。",
			EstimatedMinutes: 7, SortOrder: 47,
			Content: `Microplastics are tiny plastic particles less than five millimeters wide. They enter oceans from broken bags, synthetic clothing fibers, and tire dust on roads. Fish and shellfish ingest them, and humans may consume microplastics through seafood, salt, and bottled water.

Scientists are still measuring long-term health effects. Early studies suggest inflammation risks, but evidence remains incomplete. Solutions include better wastewater filters, biodegradable materials, and reducing single-use packaging.

The issue illustrates how durable convenience products can return to our bodies through ecological cycles.`,
			Questions: []seedReadingQuestion{
				{Stem: "How wide are microplastics defined?", Options: opts("Less than five millimeters", "Exactly one meter", "Only visible chunks", "Smaller than atoms always"), Answer: "A", Explanation: "less than five millimeters wide。"},
				{Stem: "Which source is mentioned?", Options: opts("Tire dust on roads", "Volcanic ash only", "Pure gold", "Fresh snow"), Answer: "A", Explanation: "tire dust on roads。"},
				{Stem: "What do solutions include?", Options: opts("Better wastewater filters and less single-use packaging", "Burning all oceans", "Stopping all research", "Using more plastic bags"), Answer: "A", Explanation: "better wastewater filters ... reducing single-use packaging。"},
			},
		},
		{
			Title: "Universal Basic Income Debate", Level: "高阶",
			Summary: "全民基本收入的 arguments for and against。",
			EstimatedMinutes: 7, SortOrder: 48,
			Content: `Universal Basic Income (UBI) proposes giving every citizen a regular cash payment regardless of employment. Supporters argue it simplifies welfare bureaucracy, reduces extreme poverty, and supports caregivers and artists whose labor markets undervalue.

Opponents worry about high taxes, inflation, and reduced motivation to work. Pilot programs in Finland, Kenya, and several U.S. cities produced mixed results: some recipients reported less stress and better health, while employment effects varied.

UBI is less a single policy than a lens for asking what economic security should mean in an age of automation.`,
			Questions: []seedReadingQuestion{
				{Stem: "What does UBI propose?", Options: opts("Regular cash for every citizen", "Free cars for students", "Payment only for CEOs", "Gold instead of money"), Answer: "A", Explanation: "giving every citizen a regular cash payment。"},
				{Stem: "What do opponents worry about?", Options: opts("High taxes and reduced work motivation", "Too many libraries", "Extra vacation days only", "Better health for all"), Answer: "A", Explanation: "Opponents worry about high taxes, inflation, and reduced motivation to work。"},
				{Stem: "How is UBI described in the final sentence?", Options: opts("A lens for asking about economic security", "A finished perfect system", "A sports rule", "A type of museum"), Answer: "A", Explanation: "a lens for asking what economic security should mean。"},
			},
		},
		{
			Title: "The Search for Exoplanets", Level: "高阶",
			Summary: "系外行星探测方法与「宜居带」概念。",
			EstimatedMinutes: 7, SortOrder: 49,
			Content: `Exoplanets orbit stars beyond our solar system. Astronomers detect them indirectly—measuring tiny dips in starlight when a planet crosses in front, or wobbles in a star's motion caused by gravitational pull.

Thousands of candidates have been confirmed. Some lie in the "habitable zone," where liquid water might exist on the surface. That does not guarantee life; thick atmospheres or radiation can still make worlds hostile.

Future telescopes aim to analyze atmospheric chemistry for signs such as oxygen or methane. Each discovery reframes the ancient question of whether Earth is unique.`,
			Questions: []seedReadingQuestion{
				{Stem: "How do astronomers often detect exoplanets?", Options: opts("Indirect methods like starlight dips", "Landing robots on every star", "Counting moons only", "Measuring ocean waves"), Answer: "A", Explanation: "detect them indirectly—measuring tiny dips in starlight。"},
				{Stem: "What does the habitable zone suggest?", Options: opts("Liquid water might exist", "Life is guaranteed", "No radiation exists", "Planets are always small"), Answer: "A", Explanation: "where liquid water might exist on the surface。"},
				{Stem: "What might future telescopes analyze?", Options: opts("Atmospheric chemistry", "Shopping habits", "City traffic", "School grades"), Answer: "A", Explanation: "analyze atmospheric chemistry for signs such as oxygen or methane。"},
			},
		},
		{
			Title: "Cultural Intelligence in Business", Level: "高阶",
			Summary: "跨文化沟通与全球商业中的 CQ 能力。",
			EstimatedMinutes: 7, SortOrder: 50,
			Content: `Cultural intelligence (CQ) is the ability to work effectively across national, ethnic, and organizational cultures. In global business, managers with high CQ adapt greetings, negotiation styles, and feedback methods instead of assuming one "correct" approach.

Low CQ can cause costly misunderstandings—interpreting direct speech as rude, or silence as agreement when it signals hesitation. Training often combines knowledge of customs with experiential learning abroad or on diverse teams.

As remote work connects continents, CQ becomes as important as technical expertise for building trust and sustainable partnerships.`,
			Questions: []seedReadingQuestion{
				{Stem: "What is cultural intelligence (CQ)?", Options: opts("Working effectively across cultures", "Memorizing every language", "Avoiding all travel", "Using only one greeting"), Answer: "A", Explanation: "ability to work effectively across ... cultures。"},
				{Stem: "What can low CQ cause?", Options: opts("Costly misunderstandings", "Automatic profit", "Shorter meetings always", "No need for contracts"), Answer: "A", Explanation: "Low CQ can cause costly misunderstandings。"},
				{Stem: "Why is CQ increasingly important?", Options: opts("Remote work connects continents", "All companies are local only", "Negotiation is illegal", "Trust no longer matters"), Answer: "A", Explanation: "remote work connects continents, CQ becomes as important as technical expertise。"},
			},
		},
	}
}

// opts 快速生成四选项（A/B/C/D）。
func opts(a, b, c, d string) []map[string]string {
	return []map[string]string{
		{"key": "A", "text": a},
		{"key": "B", "text": b},
		{"key": "C", "text": c},
		{"key": "D", "text": d},
	}
}
