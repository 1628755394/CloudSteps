package app

import (
	"encoding/json"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"gorm.io/gorm"
)

func (s *SeedService) seedClozePassagesExtra() error {
	passages := extraClozePassages()
	return s.DB.Transaction(func(tx *gorm.DB) error {
		for _, p := range passages {
			var count int64
			tx.Model(&models.ClozePassage{}).Where("title = ?", p.Title).Count(&count)
			if count > 0 {
				continue
			}
			passage := models.ClozePassage{
				Title:            p.Title,
				Level:            p.Level,
				Content:          p.Content,
				Summary:          p.Summary,
				Status:           models.ClozeStatusPublished,
				BlankCount:       len(p.Blanks),
				EstimatedMinutes: p.EstimatedMinutes,
				SortOrder:        p.SortOrder,
			}
			passage.SetCreateInfo("seed")
			if err := tx.Create(&passage).Error; err != nil {
				return err
			}
			for _, b := range p.Blanks {
				opts, err := json.Marshal(b.Options)
				if err != nil {
					return err
				}
				bb := models.ClozeBlank{
					PassageID: passage.ID, BlankNo: b.BlankNo, Options: string(opts),
					Answer: b.Answer, Explanation: b.Explanation,
				}
				bb.SetCreateInfo("seed")
				if err := tx.Create(&bb).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})
}

func extraClozePassages() []seedClozePassage {
	opts4 := func(a, b, c, d string) []map[string]string {
		return []map[string]string{
			{"key": "A", "text": a}, {"key": "B", "text": b},
			{"key": "C", "text": c}, {"key": "D", "text": d},
		}
	}
	blank := func(no int, o []map[string]string, ans, exp string) seedClozeBlank {
		return seedClozeBlank{BlankNo: no, Options: o, Answer: ans, Explanation: exp}
	}

	return []seedClozePassage{
		{
			Title: "At the Doctor's Office", Level: "初阶", SortOrder: 10, EstimatedMinutes: 5,
			Summary: "看医生场景：描述症状与建议。",
			Content: `When Tom woke up with a sore throat and a fever, his mother took him to see a doctor. The doctor asked how long he {{1}} unwell and listened to his chest carefully.

"You have a mild infection," the doctor said. "You should {{2}} plenty of water and rest at home for two days." Tom was relieved that he did not need any {{3}} medicine.`,
			Blanks: []seedClozeBlank{
				blank(1, opts4("is", "was", "has been", "had been"), "C", "问持续多久，用现在完成时 have/has been。"),
				blank(2, opts4("drink", "drinks", "drank", "drinking"), "A", "should 后接动词原形 drink。"),
				blank(3, opts4("strong", "stronger", "strongly", "strength"), "A", "修饰 medicine 用形容词 strong。"),
			},
		},
		{
			Title: "Learning to Ride a Bike", Level: "初阶", SortOrder: 11, EstimatedMinutes: 5,
			Summary: "学骑自行车的童年经历。",
			Content: `Lisa was nervous the first time she tried to ride a bike without training wheels. Her father held the seat and told her to keep pedaling {{1}} he let go.

After several falls, she finally {{2}} balance and rode across the yard by herself. That afternoon, she learned that practice and patience can help you {{3}} new skills.`,
			Blanks: []seedClozeBlank{
				blank(1, opts4("when", "while", "until", "after"), "C", "until 表示“直到……才”。"),
				blank(2, opts4("keep", "kept", "keeps", "keeping"), "B", "叙述过去用 kept。"),
				blank(3, opts4("master", "masters", "mastered", "mastering"), "A", "help you (to) do，接动词原形。"),
			},
		},
		{
			Title: "A Trip to the Museum", Level: "初阶", SortOrder: 12, EstimatedMinutes: 5,
			Summary: "博物馆参观短文。",
			Content: `Our class visited the science museum last Friday. The guide explained how ancient tools {{1}} made and showed us a model of the solar system.

The most exciting part was the interactive lab, where we {{2}} simple experiments with light and magnets. Before leaving, everyone {{3}} a small notebook as a souvenir.`,
			Blanks: []seedClozeBlank{
				blank(1, opts4("are", "were", "was", "is"), "B", "tools 为复数，过去被动 were made。"),
				blank(2, opts4("do", "did", "done", "doing"), "B", "叙述过去参观，用 did。"),
				blank(3, opts4("receive", "received", "receives", "receiving"), "B", "过去时 received。"),
			},
		},
		{
			Title: "Saving Pocket Money", Level: "中阶", SortOrder: 13, EstimatedMinutes: 6,
			Summary: "攒零花钱买礼物。",
			Content: `Emma had been saving pocket money for months because she wanted to buy her brother a birthday gift. She {{1}} snacks after school and wrote down every coin she earned.

When she finally counted her savings, she {{2}} she had enough for the headphones he admired online. Her parents were proud that she had learned to plan {{3}} she spent.`,
			Blanks: []seedClozeBlank{
				blank(1, opts4("avoided", "avoids", "avoid", "avoiding"), "A", "过去时 avoided。"),
				blank(2, opts4("realized", "realizes", "realize", "realizing"), "A", "叙述过去 realized。"),
				blank(3, opts4("before", "after", "unless", "although"), "A", "plan before she spent，在花钱前规划。"),
			},
		},
		{
			Title: "Working from Home", Level: "中阶", SortOrder: 14, EstimatedMinutes: 6,
			Summary: "远程办公的利弊。",
			Content: `Many companies now allow employees to work from home several days a week. Supporters say it reduces commuting time and helps people {{1}} a better work-life balance.

However, managers worry that some workers may feel {{2}} from their teams. Successful remote work usually requires clear goals, regular online meetings, and a quiet space {{3}} people can focus.`,
			Blanks: []seedClozeBlank{
				blank(1, opts4("achieve", "achieves", "achieved", "achieving"), "A", "help people achieve，不定式省略 to。"),
				blank(2, opts4("disconnect", "disconnected", "disconnecting", "disconnection"), "B", "feel disconnected 感到与团队脱节。"),
				blank(3, opts4("which", "where", "who", "what"), "B", "space 作地点，where 引导定语从句。"),
			},
		},
		{
			Title: "The Power of Reading", Level: "中阶", SortOrder: 15, EstimatedMinutes: 6,
			Summary: "阅读习惯的益处。",
			Content: `Research shows that people who read regularly often have stronger vocabulary and better focus. Reading fiction, {{1}}, can improve empathy because readers imagine life from different characters' points of view.

Schools that encourage daily reading report that students perform {{2}} in writing tasks. Even fifteen minutes a day can make a difference {{3}} students stick to the habit.`,
			Blanks: []seedClozeBlank{
				blank(1, opts4("however", "therefore", "in particular", "instead"), "C", "in particular 表示“尤其”。"),
				blank(2, opts4("well", "better", "best", "good"), "B", "perform better 比较级。"),
				blank(3, opts4("if", "unless", "although", "while"), "A", "if 引导条件状语从句。"),
			},
		},
		{
			Title: "Urban Green Spaces", Level: "中阶", SortOrder: 16, EstimatedMinutes: 6,
			Summary: "城市绿化的意义。",
			Content: `City parks do more than provide places for exercise. Trees and plants help {{1}} air pollution and lower temperatures in crowded neighborhoods.

Experts argue that access to green spaces should be treated {{2}} a basic public service, not a luxury. When communities invest in parks, residents often report {{3}} stress and stronger social connections.`,
			Blanks: []seedClozeBlank{
				blank(1, opts4("reduce", "reduces", "reduced", "reducing"), "A", "help (to) reduce，动词原形。"),
				blank(2, opts4("as", "like", "for", "by"), "A", "treat ... as 把……视为。"),
				blank(3, opts4("less", "fewer", "little", "least"), "A", "less stress，不可数名词用 less。"),
			},
		},
		{
			Title: "Artificial Intelligence in Education", Level: "高阶", SortOrder: 17, EstimatedMinutes: 7,
			Summary: "AI 在教育中的应用与边界。",
			Content: `Artificial intelligence is increasingly used to personalize learning paths and provide instant feedback on language exercises. Proponents claim that adaptive systems can identify gaps in knowledge {{1}} traditional classrooms might overlook.

Critics, {{2}}, warn that over-reliance on algorithms could weaken critical thinking if students accept suggestions without question. The most balanced approach treats AI as a supplement {{3}} replaces thoughtful teaching.`,
			Blanks: []seedClozeBlank{
				blank(1, opts4("where", "which", "that", "what"), "C", "gaps ... that classrooms might overlook。"),
				blank(2, opts4("however", "therefore", "moreover", "meanwhile"), "A", "转折 however。"),
				blank(3, opts4("rather than", "as well as", "in addition to", "because of"), "A", "supplement rather than replaces，而非取代。"),
			},
		},
		{
			Title: "Renewable Energy Transition", Level: "高阶", SortOrder: 18, EstimatedMinutes: 7,
			Summary: "能源转型挑战。",
			Content: `Countries around the world are investing heavily in solar and wind power to cut carbon emissions. While renewable sources are becoming cheaper, energy storage remains a key {{1}} because sunlight and wind are not always available.

Engineers are developing better batteries and grid systems that can distribute power {{2}} efficiently. Policymakers must also consider how to support workers whose jobs depend {{3}} fossil fuels.`,
			Blanks: []seedClozeBlank{
				blank(1, opts4("challenge", "challenging", "challenged", "challenger"), "A", "a key challenge 名词。"),
				blank(2, opts4("more", "most", "much", "many"), "A", "more efficiently 比较级修饰副词。"),
				blank(3, opts4("on", "in", "at", "for"), "A", "depend on 固定搭配。"),
			},
		},
		{
			Title: "Cultural Exchange Programs", Level: "高阶", SortOrder: 19, EstimatedMinutes: 7,
			Summary: "跨文化交换项目价值。",
			Content: `Student exchange programs offer more than language practice; they expose participants to unfamiliar customs and ways of solving problems. Many alumni say the experience changed how they {{1}} cultural differences.

Host families often become lifelong friends, and students return home with greater confidence {{2}} communicating across borders. Universities that fund these programs argue they produce graduates who are better prepared {{3}} global careers.`,
			Blanks: []seedClozeBlank{
				blank(1, opts4("view", "views", "viewed", "viewing"), "A", "how they view，一般现在时。"),
				blank(2, opts4("in", "on", "at", "for"), "A", "confidence in doing 固定搭配。"),
				blank(3, opts4("for", "to", "with", "by"), "A", "prepared for careers。"),
			},
		},
		{
			Title: "Sleep and Memory", Level: "高阶", SortOrder: 20, EstimatedMinutes: 7,
			Summary: "睡眠与记忆巩固。",
			Content: `Neuroscientists have found that sleep plays an essential role in consolidating memories. During deep sleep, the brain replays information learned during the day, which helps students {{1}} vocabulary and grammar more effectively.

Teenagers who sleep less than seven hours often struggle to concentrate in class and may perform {{2}} on exams. Teachers therefore encourage regular schedules and advise learners to review material briefly {{3}} going to bed.`,
			Blanks: []seedClozeBlank{
				blank(1, opts4("retain", "retains", "retained", "retaining"), "A", "help students retain，动词原形。"),
				blank(2, opts4("poorly", "poor", "worse", "worst"), "A", "perform poorly 副词修饰动词。"),
				blank(3, opts4("before", "after", "while", "since"), "A", "before going to bed 睡前。"),
			},
		},
		{
			Title: "Volunteering in the Community", Level: "中阶", SortOrder: 21, EstimatedMinutes: 6,
			Summary: "社区志愿活动。",
			Content: `Last winter, dozens of students volunteered at a local food bank. They sorted donations, packed boxes, and {{1}} elderly residents carry groceries to their cars.

The organizer said the event would not have succeeded {{2}} so many people had offered their time. Participants left feeling that small actions, when combined, could {{3}} a real difference to neighbors in need.`,
			Blanks: []seedClozeBlank{
				blank(1, opts4("helped", "help", "helps", "helping"), "A", "过去时 helped。"),
				blank(2, opts4("if", "unless", "although", "because"), "A", "would not have succeeded if... 虚拟语气。"),
				blank(3, opts4("make", "makes", "made", "making"), "A", "make a difference 固定搭配。"),
			},
		},
	}
}
