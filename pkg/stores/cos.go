package stores

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/LingByte/CloudStepsGo/pkg/utils"
	"github.com/tencentyun/cos-go-sdk-v5"
)

type CosStore struct {
	SecretID   string `env:"COS_SECRET_ID"`
	SecretKey  string `env:"COS_SECRET_KEY"`
	Region     string `env:"COS_REGION"`
	BucketName string `env:"COS_BUCKET_NAME"`
}

// Delete implements Store.
func (c *CosStore) Delete(key string) error {
	if c.SecretID == "" || c.SecretKey == "" || c.Region == "" {
		return fmt.Errorf("COS credentials not configured")
	}

	cClient := InitCos(c.BucketName, c)
	_, err := cClient.Object.Delete(context.Background(), key)
	return err
}

// Exists implements Store.
func (c *CosStore) Exists(key string) (bool, error) {
	if c.SecretID == "" || c.SecretKey == "" || c.Region == "" {
		return false, fmt.Errorf("COS credentials not configured")
	}

	cClient := InitCos(c.BucketName, c)
	ok, err := cClient.Object.IsExist(context.Background(), key)
	return ok, err
}

// Read implements Store.
func (c *CosStore) Read(key string) (io.ReadCloser, int64, error) {
	if c.SecretID == "" || c.SecretKey == "" || c.Region == "" {
		return nil, 0, fmt.Errorf("COS credentials not configured")
	}
	cClient := InitCos(c.BucketName, c)
	resp, err := cClient.Object.Get(context.Background(), key, nil)
	if err != nil {
		return nil, 0, err
	}
	var size int64 = -1
	if cl := resp.Header.Get("Content-Length"); cl != "" {
		if v, err := fmt.Sscanf(cl, "%d", &size); err != nil || v != 1 {
			size = -1
		}
	}

	return resp.Body, size, nil
}

// Write implements Store.
func (c *CosStore) Write(key string, r io.Reader) error {
	if c.SecretID == "" || c.SecretKey == "" || c.Region == "" {
		return fmt.Errorf("COS credentials not configured")
	}

	cClient := InitCos(c.BucketName, c)
	_, err := cClient.Object.Put(context.Background(), key, r, nil)
	return err
}

// SignedURL implements PrivateURLSigner via a COS presigned GET.
func (c *CosStore) SignedURL(key string, expires time.Duration) (string, error) {
	if c.SecretID == "" || c.SecretKey == "" || c.Region == "" {
		return "", fmt.Errorf("COS credentials not configured")
	}
	cClient := InitCos(c.BucketName, c)
	u, err := cClient.Object.GetPresignedURL(context.Background(), http.MethodGet, key, c.SecretID, c.SecretKey, expires, nil)
	if err != nil {
		return "", err
	}
	return u.String(), nil
}

// PresignUpload implements DirectUploadPresigner via a COS presigned PUT.
func (c *CosStore) PresignUpload(key, contentType string, expires time.Duration) (*DirectUpload, error) {
	if c.SecretID == "" || c.SecretKey == "" || c.Region == "" {
		return nil, fmt.Errorf("COS credentials not configured")
	}
	cClient := InitCos(c.BucketName, c)
	u, err := cClient.Object.GetPresignedURL(context.Background(), http.MethodPut, key, c.SecretID, c.SecretKey, expires, nil)
	if err != nil {
		return nil, err
	}
	headers := map[string]string{}
	if contentType != "" {
		headers["Content-Type"] = contentType
	}
	return &DirectUpload{
		Provider:  KindCos,
		Method:    http.MethodPut,
		URL:       u.String(),
		Headers:   headers,
		Key:       key,
		ExpiresAt: time.Now().Add(expires),
	}, nil
}

func (c *CosStore) PublicURL(key string) string {
	return fmt.Sprintf("https://%s.cos.%s.myqcloud.com/%s", c.BucketName, c.Region, key)
}

func NewCosStore() Store {
	return &CosStore{
		SecretID:   utils.GetEnv("COS_SECRET_ID"),
		SecretKey:  utils.GetEnv("COS_SECRET_KEY"),
		Region:     utils.GetEnv("COS_REGION"),
		BucketName: utils.GetEnv("COS_BUCKET_NAME"),
	}
}

func InitCos(bucketName string, c *CosStore) *cos.Client {
	if bucketName == "" {
		bucketName = c.BucketName
	}
	bucketURL := fmt.Sprintf("https://%s.cos.%s.myqcloud.com", bucketName, c.Region)
	u, _ := url.Parse(bucketURL)
	b := &cos.BaseURL{BucketURL: u}

	cClient := cos.NewClient(b, &http.Client{
		Transport: &cos.AuthorizationTransport{
			SecretID:  c.SecretID,
			SecretKey: c.SecretKey,
		},
	})
	return cClient
}
