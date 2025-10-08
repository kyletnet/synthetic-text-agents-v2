/**
 * Korean Named Entity Recognition (NER)
 *
 * Pattern-based NER specialized for Korean language.
 * Recognizes:
 * - Person names (Korean 2-4 characters, Western names, Hanja)
 * - Locations (cities, countries, regions)
 * - Terms (domain-specific terminology)
 * - Dates (centuries, years, periods)
 */

import type { Entity, EntityRecognizer } from "./entity-recognizer.js";

export class KoreanNER implements EntityRecognizer {
  private patterns: Record<
    string,
    { regex: RegExp; type: Entity["type"]; confidence: number }
  > = {
    // 한국어 이름 (2-4자)
    korean_person: {
      regex: /([가-힣]{2,4})(?=\s|,|\.|\(|는|이|가|을|를|의|에|와|과)/g,
      type: "PERSON",
      confidence: 0.7, // 중간 신뢰도 (일반 단어와 구분 어려움)
    },

    // 서양 이름 (대문자 시작, 2단어)
    western_person: {
      regex: /([A-Z][a-z]+\s+[A-Z][a-z]+)/g,
      type: "PERSON",
      confidence: 0.85, // 높은 신뢰도 (패턴이 명확)
    },

    // 한자 이름 (2-4자)
    hanja_person: {
      regex: /([一-龥]{2,4})/g,
      type: "PERSON",
      confidence: 0.75, // 중-높은 신뢰도
    },

    // 지명 - 한국 (시/도)
    korean_location: {
      regex:
        /([가-힣]+시|[가-힣]+도)(?=\s|,|\.|\(|는|이|가|을|를|의|에|와|과)/g,
      type: "LOCATION",
      confidence: 0.9, // 매우 높은 신뢰도 (패턴이 명확)
    },

    // 지명 - 외국 (잘 알려진 도시/국가)
    foreign_location: {
      regex:
        /(시칠리아|베네치아|밀라노|메시나|시에나|피렌체|플랑드르|네덜란드|프랑스|이탈리아|스페인|영국|독일)/g,
      type: "LOCATION",
      confidence: 0.95, // 사전 기반으로 매우 높음
    },

    // 전문 용어 (예술 분야)
    art_term: {
      regex:
        /(르네상스|고딕|국제고딕양식|유화|명암표현법|원근법|성상화|패널화|템페라|제단화|조각|회화|건축|양식|기법)/g,
      type: "TERM",
      confidence: 0.9, // 매우 높은 신뢰도
    },

    // 날짜 (세기, 연대)
    date_century: {
      regex: /(\d{1,2}세기)/g,
      type: "DATE",
      confidence: 0.98, // 거의 확실
    },

    date_year: {
      regex: /(\d{4}년대?)/g,
      type: "DATE",
      confidence: 0.98,
    },
  };

  async extractEntities(text: string, _domain?: string): Promise<Entity[]> {
    const entities: Entity[] = [];

    // 각 패턴으로 추출
    for (const [patternName, { regex, type, confidence }] of Object.entries(
      this.patterns,
    )) {
      // RegExp를 매번 새로 생성 (lastIndex 초기화)
      const pattern = new RegExp(regex.source, regex.flags);
      const matches = [...text.matchAll(pattern)];

      for (const match of matches) {
        const matchedText = match[1]; // capture group
        const index = match.index!;

        entities.push({
          text: matchedText,
          type,
          confidence,
          span: [index, index + matchedText.length],
          source: "ner",
        });
      }
    }

    // 중복 제거 및 정렬
    return this.deduplicateEntities(entities);
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

    return this.deduplicateEntities(allEntities);
  }

  /**
   * 중복 제거 로직
   *
   * 같은 텍스트의 엔티티는:
   * 1. 가장 높은 신뢰도를 선택
   * 2. 같은 신뢰도면 더 구체적인 타입 선택 (PERSON > TERM > OTHER)
   */
  private deduplicateEntities(entities: Entity[]): Entity[] {
    const seen = new Map<string, Entity>();

    for (const entity of entities) {
      const key = `${entity.text.toLowerCase()}_${entity.type}`;
      const existing = seen.get(key);

      if (!existing) {
        seen.set(key, entity);
      } else {
        // 신뢰도 비교
        if (entity.confidence > existing.confidence) {
          seen.set(key, entity);
        } else if (entity.confidence === existing.confidence) {
          // 타입 우선순위 비교
          if (
            this.getTypePriority(entity.type) >
            this.getTypePriority(existing.type)
          ) {
            seen.set(key, entity);
          }
        }
      }
    }

    // 신뢰도 순으로 정렬
    return Array.from(seen.values()).sort(
      (a, b) => b.confidence - a.confidence,
    );
  }

  private getTypePriority(type: Entity["type"]): number {
    const priority: Record<Entity["type"], number> = {
      PERSON: 5,
      LOCATION: 4,
      DATE: 4,
      TERM: 3,
      OTHER: 1,
    };
    return priority[type] || 0;
  }
}
