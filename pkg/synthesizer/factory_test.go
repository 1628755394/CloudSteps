package synthesizer

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestFactoryRegistersAllProviders(t *testing.T) {
	want := []Provider{
		ProviderTencent,
		ProviderAliyun,
		ProviderAWS,
		ProviderAzure,
		ProviderBaidu,
		ProviderCoqui,
		ProviderElevenLabs,
		ProviderFishAudio,
		ProviderFishSpeech,
		ProviderGoogle,
		ProviderLocal,
		ProviderLocalGoSpeech,
		ProviderMinimax,
		ProviderOpenAI,
		ProviderQiniu,
		ProviderXunfei,
		ProviderVolcengine,
		ProviderVolcengineClone,
		ProviderVolcengineLLM,
	}
	got := map[Provider]bool{}
	for _, p := range SupportedProviders() {
		got[p] = true
	}
	for _, p := range want {
		require.Truef(t, got[p], "missing provider %s", p)
	}
}

func TestNormalizeProviderAliases(t *testing.T) {
	require.Equal(t, ProviderTencent, NormalizeProvider(""))
	require.Equal(t, ProviderTencent, NormalizeProvider("tts.qcloud"))
	require.Equal(t, ProviderTencent, NormalizeProvider("tencent"))
	require.Equal(t, ProviderOpenAI, NormalizeProvider("OPENAI"))
	require.Equal(t, ProviderVolcengineClone, NormalizeProvider("volc_clone"))
}

func TestConfigFromEnvQCloud(t *testing.T) {
	t.Setenv("QCLOUD_APP_ID", "123")
	t.Setenv("QCLOUD_SECRET_ID", "sid")
	t.Setenv("QCLOUD_SECRET", "sk")
	t.Setenv("QCLOUD_VOICE_TYPE", "1005")

	cfg, err := ConfigFromEnv(ProviderTencent)
	require.NoError(t, err)
	require.Equal(t, ProviderTencent, cfg.GetProvider())

	eng, err := CreateEngine(cfg)
	require.NoError(t, err)
	require.NotNil(t, eng)
	require.Equal(t, ProviderTencent, eng.Provider())
	_ = eng.Close()
}
