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
	t.Setenv("QCLOUD_TTS_ACCOUNTS", `[{"appId":"123","secretId":"sid","secret":"sk"}]`)

	cfg, err := ConfigFromEnv(ProviderTencent)
	require.NoError(t, err)
	require.Equal(t, ProviderTencent, cfg.GetProvider())

	eng, err := CreateEngine(cfg)
	require.NoError(t, err)
	require.NotNil(t, eng)
	require.Equal(t, ProviderTencent, eng.Provider())
	_ = eng.Close()
}

func TestLoadQCloudAccountsRoundRobin(t *testing.T) {
	t.Setenv("QCLOUD_TTS_ACCOUNTS", `[
		{"appId":"1","secretId":"a","secret":"x"},
		{"app_id":"2","secret_id":"b","secret_key":"y"}
	]`)

	accounts, err := LoadQCloudAccounts()
	require.NoError(t, err)
	require.Len(t, accounts, 2)
	require.Equal(t, "1", accounts[0].AppID)
	require.Equal(t, "2", accounts[1].AppID)

	cfg1, err := NewQCloudConfig(QCloudOverrides{})
	require.NoError(t, err)
	cfg2, err := NewQCloudConfig(QCloudOverrides{})
	require.NoError(t, err)
	require.Equal(t, DefaultQCloudVoiceType, cfg1.VoiceType)
	require.Equal(t, DefaultQCloudVoiceType, cfg2.VoiceType)
	require.NotEqual(t, cfg1.AppID, cfg2.AppID)
}
