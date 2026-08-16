package voice

import (
	"context"

	lingllm "github.com/LingByte/lingllm/realtime"
	"github.com/LingByte/ling-base/realtime"
)

// adaptAgent wraps a ling-base realtime.Agent as a lingllm realtime.Agent so
// it can be passed to the xiaozhi protocol server (which still imports
// lingllm/realtime). Once xiaozhi is migrated to ling-base this adapter can
// be removed.
type adaptAgent struct {
	inner realtime.Agent
}

func adapt(a realtime.Agent) lingllm.Agent {
	if a == nil {
		return nil
	}
	return &adaptAgent{inner: a}
}

func (a *adaptAgent) Start(ctx context.Context) error { return a.inner.Start(ctx) }
func (a *adaptAgent) PushAudio(pcm []byte) error      { return a.inner.PushAudio(pcm) }
func (a *adaptAgent) CommitInputAudio() error         { return a.inner.CommitInputAudio() }
func (a *adaptAgent) Cancel() error                   { return a.inner.Cancel() }
func (a *adaptAgent) Close() error                    { return a.inner.Close() }
func (a *adaptAgent) UpdateInstructions(s string) error {
	return a.inner.UpdateInstructions(s)
}

// adaptEvent converts a ling-base realtime.Event into a lingllm realtime.Event.
func adaptEvent(ev realtime.Event) lingllm.Event {
	return lingllm.Event{
		Type:    lingllm.EventType(ev.Type),
		Text:    ev.Text,
		Final:   ev.Final,
		AudioPC: ev.AudioPC,
		Err:     ev.Err,
		Fatal:   ev.Fatal,
		Vendor:  ev.Vendor,
		Raw:     ev.Raw,
	}
}
