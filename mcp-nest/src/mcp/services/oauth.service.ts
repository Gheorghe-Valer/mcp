import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface OAuth2Config {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
}

export interface OAuth2Token {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  expires_at?: number;
}

@Injectable()
export class OAuth2Service {
  private readonly logger = new Logger(OAuth2Service.name);
  private tokenCache = new Map<string, OAuth2Token>();
  private axiosInstance: AxiosInstance;

  constructor(private configService: ConfigService) {
    this.axiosInstance = axios.create({
      timeout: 30000,
    });
  }

  async getAccessToken(config: OAuth2Config): Promise<string> {
    const cacheKey = this.generateCacheKey(config);
    const cachedToken = this.tokenCache.get(cacheKey);

    if (cachedToken && this.isTokenValid(cachedToken)) {
      this.logger.debug('Using cached OAuth2 token');
      return cachedToken.access_token;
    }

    this.logger.log('Requesting new OAuth2 token...');
    const token = await this.requestAccessToken(config);
    
    token.expires_at = Date.now() + (token.expires_in * 1000);
    this.tokenCache.set(cacheKey, token);
    
    this.logger.log('OAuth2 token obtained successfully');
    return token.access_token;
  }

  private async requestAccessToken(config: OAuth2Config): Promise<OAuth2Token> {
    try {
      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');
      params.append('client_id', config.clientId);
      params.append('client_secret', config.clientSecret);
      
      if (config.scope) {
        params.append('scope', config.scope);
      }

      const response = await this.axiosInstance.post(config.tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      return response.data as OAuth2Token;
    } catch (error: any) {
      this.logger.error('Failed to obtain OAuth2 token', error.response?.data || error.message);
      throw error;
    }
  }

  private isTokenValid(token: OAuth2Token): boolean {
    if (!token.expires_at) return false;
    
    const bufferTime = 60 * 1000;
    return Date.now() < (token.expires_at - bufferTime);
  }

  private generateCacheKey(config: OAuth2Config): string {
    return `${config.tokenUrl}:${config.clientId}`;
  }

  clearTokenCache(config?: OAuth2Config): void {
    if (config) {
      const cacheKey = this.generateCacheKey(config);
      this.tokenCache.delete(cacheKey);
      this.logger.log('OAuth2 token cache cleared for specific config');
    } else {
      this.tokenCache.clear();
      this.logger.log('All OAuth2 token cache cleared');
    }
  }
}