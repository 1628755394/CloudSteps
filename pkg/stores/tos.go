package stores

import (
	"context"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/LingByte/CloudStepsGo/pkg/utils"
	"github.com/volcengine/ve-tos-golang-sdk/v2/tos"
	"github.com/volcengine/ve-tos-golang-sdk/v2/tos/enum"
)

// TosStore implements Store for Volcengine TOS (Object Storage).
type TosStore struct {
	Endpoint        string `env:"TOS_ENDPOINT"`
	Region          string `env:"TOS_REGION"`
	AccessKeyID     string `env:"TOS_ACCESS_KEY_ID"`
	AccessKeySecret string `env:"TOS_SECRET_ACCESS_KEY"`
	BucketName      string `env:"TOS_BUCKET"`
	Domain          string `env:"TOS_DOMAIN"` // Optional custom domain for public access
}

// NewTosStore creates a TOS storage instance from environment variables.
func NewTosStore() Store {
	return &TosStore{
		Endpoint:        utils.GetEnv("TOS_ENDPOINT"),
		Region:          utils.GetEnv("TOS_REGION"),
		AccessKeyID:     utils.GetEnv("TOS_ACCESS_KEY_ID"),
		AccessKeySecret: utils.GetEnv("TOS_SECRET_ACCESS_KEY"),
		BucketName:      utils.GetEnv("TOS_BUCKET"),
		Domain:          utils.GetEnv("TOS_DOMAIN"),
	}
}

func (s *TosStore) client(ctx context.Context) (*tos.ClientV2, error) {
	return tos.NewClientV2(
		s.Endpoint,
		tos.WithRegion(s.Region),
		tos.WithCredentials(tos.NewStaticCredentials(s.AccessKeyID, s.AccessKeySecret)),
	)
}

// Read reads a file from TOS.
func (s *TosStore) Read(key string) (io.ReadCloser, int64, error) {
	ctx := context.Background()
	client, err := s.client(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to create TOS client: %w", err)
	}

	result, err := client.GetObjectV2(ctx, &tos.GetObjectV2Input{
		Bucket: s.BucketName,
		Key:    key,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get object from TOS: %w", err)
	}

	var size int64
	if result.ContentLength > 0 {
		size = result.ContentLength
	}

	return result.Content, size, nil
}

// Write writes a file to TOS.
func (s *TosStore) Write(key string, r io.Reader) error {
	ctx := context.Background()
	client, err := s.client(ctx)
	if err != nil {
		return fmt.Errorf("failed to create TOS client: %w", err)
	}

	_, err = client.PutObjectV2(ctx, &tos.PutObjectV2Input{
		PutObjectBasicInput: tos.PutObjectBasicInput{
			Bucket: s.BucketName,
			Key:    key,
		},
		Content: r,
	})
	if err != nil {
		return fmt.Errorf("failed to upload object to TOS: %w", err)
	}
	return nil
}

// Delete deletes a file from TOS.
func (s *TosStore) Delete(key string) error {
	ctx := context.Background()
	client, err := s.client(ctx)
	if err != nil {
		return fmt.Errorf("failed to create TOS client: %w", err)
	}

	_, err = client.DeleteObjectV2(ctx, &tos.DeleteObjectV2Input{
		Bucket: s.BucketName,
		Key:    key,
	})
	if err != nil {
		return fmt.Errorf("failed to delete object from TOS: %w", err)
	}
	return nil
}

// Exists checks if a file exists in TOS.
func (s *TosStore) Exists(key string) (bool, error) {
	ctx := context.Background()
	client, err := s.client(ctx)
	if err != nil {
		return false, fmt.Errorf("failed to create TOS client: %w", err)
	}

	_, err = client.HeadObjectV2(ctx, &tos.HeadObjectV2Input{
		Bucket: s.BucketName,
		Key:    key,
	})
	if err != nil {
		if strings.Contains(err.Error(), "404") || strings.Contains(strings.ToLower(err.Error()), "not found") {
			return false, nil
		}
		return false, fmt.Errorf("failed to check object existence in TOS: %w", err)
	}
	return true, nil
}

// SignedURL implements PrivateURLSigner via a TOS presigned GET.
func (s *TosStore) SignedURL(key string, expires time.Duration) (string, error) {
	client, err := s.client(context.Background())
	if err != nil {
		return "", fmt.Errorf("failed to create TOS client: %w", err)
	}
	out, err := client.PreSignedURL(&tos.PreSignedURLInput{
		HTTPMethod: enum.HttpMethodGet,
		Bucket:     s.BucketName,
		Key:        key,
		Expires:    int64(expires / time.Second),
	})
	if err != nil {
		return "", fmt.Errorf("failed to presign TOS get: %w", err)
	}
	return out.SignedUrl, nil
}

// PresignUpload implements DirectUploadPresigner via a TOS presigned PUT.
func (s *TosStore) PresignUpload(key, contentType string, expires time.Duration) (*DirectUpload, error) {
	client, err := s.client(context.Background())
	if err != nil {
		return nil, fmt.Errorf("failed to create TOS client: %w", err)
	}
	in := &tos.PreSignedURLInput{
		HTTPMethod: enum.HttpMethodPut,
		Bucket:     s.BucketName,
		Key:        key,
		Expires:    int64(expires / time.Second),
	}
	headers := map[string]string{}
	if contentType != "" {
		in.Header = map[string]string{"Content-Type": contentType}
		headers["Content-Type"] = contentType
	}
	out, err := client.PreSignedURL(in)
	if err != nil {
		return nil, fmt.Errorf("failed to presign TOS put: %w", err)
	}
	return &DirectUpload{
		Provider:  KindTos,
		Method:    "PUT",
		URL:       out.SignedUrl,
		Headers:   headers,
		Key:       key,
		ExpiresAt: time.Now().Add(expires),
	}, nil
}

// PublicURL returns the public URL for a file in TOS.
func (s *TosStore) PublicURL(key string) string {
	key = strings.TrimPrefix(key, "/")
	if s.Domain != "" {
		domain := strings.TrimSuffix(s.Domain, "/")
		if !strings.HasPrefix(domain, "http://") && !strings.HasPrefix(domain, "https://") {
			domain = "https://" + domain
		}
		return fmt.Sprintf("%s/%s", domain, key)
	}
	endpoint := strings.TrimPrefix(strings.TrimPrefix(s.Endpoint, "https://"), "http://")
	return fmt.Sprintf("https://%s.%s/%s", s.BucketName, endpoint, key)
}
