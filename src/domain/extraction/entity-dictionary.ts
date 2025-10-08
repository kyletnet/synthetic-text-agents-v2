/**
 * Entity Dictionary
 *
 * Domain-specific entity dictionaries for high-confidence extraction.
 * Provides curated lists of known entities by domain.
 */

import type { Entity, EntityRecognizer } from "./entity-recognizer.js";

/**
 * Domain entity dictionaries
 */
export const DOMAIN_ENTITIES = {
  art_renaissance: {
    persons: [
      // 이탈리아 르네상스
      "마사초",
      "브루넬레스키",
      "도나텔로",
      "안토넬로",
      "두초",
      "구이디",
      "조토",
      "치마부에",
      "미켈란젤로",
      "레오나르도 다 빈치",
      "라파엘로",
      "보티첼리",
      // 북유럽 르네상스
      "얀 반 에이크",
      "로히어 반 데르 베이덴",
      "히에로니무스 보스",
      "알브레히트 뒤러",
      "페테르 브뤼헬",
    ],
    locations: [
      // 이탈리아
      "피렌체",
      "시에나",
      "베네치아",
      "밀라노",
      "로마",
      "메시나",
      "시칠리아",
      // 북유럽
      "플랑드르",
      "네덜란드",
      "브뤼헤",
      "겐트",
      // 기타
      "프랑스",
      "스페인",
      "영국",
      "독일",
    ],
    terms: [
      // 양식
      "르네상스",
      "고딕",
      "국제고딕양식",
      "바로크",
      "매너리즘",
      // 기법
      "유화",
      "템페라",
      "프레스코",
      "명암표현법",
      "원근법",
      "스푸마토",
      "키아로스쿠로",
      // 장르/형식
      "성상화",
      "패널화",
      "제단화",
      "초상화",
      "종교화",
      "역사화",
      // 기타
      "조각",
      "회화",
      "건축",
      "소묘",
      "판화",
    ],
  },

  // 다른 도메인 추가 가능 (예: 과학, 역사, 기술 등)
  science_physics: {
    persons: [
      "아인슈타인",
      "뉴턴",
      "갈릴레오",
      "맥스웰",
      "보어",
      "하이젠베르크",
      "슈뢰딩거",
    ],
    locations: ["케임브리지", "프린스턴", "취리히", "괴팅겐"],
    terms: [
      "상대성이론",
      "양자역학",
      "중력",
      "전자기학",
      "열역학",
      "광학",
      "입자물리학",
    ],
  },
} as const;

export type DomainName = keyof typeof DOMAIN_ENTITIES;

/**
 * Dictionary-based entity extractor
 *
 * Provides very high confidence (0.95) for known entities.
 */
export class DictionaryBasedExtractor implements EntityRecognizer {
  async extractEntities(
    text: string,
    domain: string = "art_renaissance",
  ): Promise<Entity[]> {
    const dict =
      DOMAIN_ENTITIES[domain as DomainName] || DOMAIN_ENTITIES.art_renaissance;
    const entities: Entity[] = [];

    // Extract persons
    for (const keyword of dict.persons) {
      const regex = new RegExp(this.escapeRegex(keyword), "g");
      const matches = [...text.matchAll(regex)];

      for (const match of matches) {
        entities.push({
          text: match[0],
          type: "PERSON",
          confidence: 0.95, // 사전 기반은 신뢰도 매우 높음
          span: [match.index!, match.index! + match[0].length],
          source: "dictionary",
        });
      }
    }

    // Extract locations
    for (const keyword of dict.locations) {
      const regex = new RegExp(this.escapeRegex(keyword), "g");
      const matches = [...text.matchAll(regex)];

      for (const match of matches) {
        entities.push({
          text: match[0],
          type: "LOCATION",
          confidence: 0.95,
          span: [match.index!, match.index! + match[0].length],
          source: "dictionary",
        });
      }
    }

    // Extract terms
    for (const keyword of dict.terms) {
      const regex = new RegExp(this.escapeRegex(keyword), "g");
      const matches = [...text.matchAll(regex)];

      for (const match of matches) {
        entities.push({
          text: match[0],
          type: "TERM",
          confidence: 0.95,
          span: [match.index!, match.index! + match[0].length],
          source: "dictionary",
        });
      }
    }

    return entities;
  }

  async extractFromMultipleTexts(
    texts: string[],
    domain?: string,
  ): Promise<Entity[]> {
    const allEntities: Entity[] = [];

    for (const text of texts) {
      const entities = await this.extractEntities(text, domain);
      allEntities.push(...entities);
    }

    // 중복 제거 (같은 텍스트의 엔티티는 하나만 유지)
    const seen = new Set<string>();
    const deduplicated: Entity[] = [];

    for (const entity of allEntities) {
      const key = `${entity.text}_${entity.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(entity);
      }
    }

    return deduplicated;
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}

/**
 * Get available domains
 */
export function getAvailableDomains(): DomainName[] {
  return Object.keys(DOMAIN_ENTITIES) as DomainName[];
}

/**
 * Get entity counts for a domain
 */
export function getDomainEntityCounts(domain: DomainName = "art_renaissance"): {
  persons: number;
  locations: number;
  terms: number;
  total: number;
} {
  const dict = DOMAIN_ENTITIES[domain];

  return {
    persons: dict.persons.length,
    locations: dict.locations.length,
    terms: dict.terms.length,
    total: dict.persons.length + dict.locations.length + dict.terms.length,
  };
}
