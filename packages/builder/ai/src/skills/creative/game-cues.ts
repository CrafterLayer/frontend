/*
  Words that ask a creative piece for sound, enemy AI or a HUD (game libraries, 2026-10-12).

  Single words like "music", "enemies" or "xp" are far too common to activate a skill on
  their own — a music school, a security patrol or a health clinic is not a game. So they count
  only where a creative piece is already certain: the planner reads them inside a creative brief,
  and the selection lane (`pixiSkillIdsFor`) only after a game/story playbook matched. The skills'
  own auto keywords are the narrow game phrases.
*/

export interface GameLibCue {
  readonly lib: 'audio' | 'gameai' | 'hud';
  readonly skill: string;
  readonly words: readonly string[];
}

export const GAME_LIB_CUES: readonly GameLibCue[] = [
  {
    lib: 'gameai',
    skill: 'craftkit.pixi-game-ai',
    words: [
      'enemy',
      'enemies',
      'monster',
      'monsters',
      'npc',
      'npcs',
      'chase',
      'chases',
      'chasing',
      'patrol',
      'patrols',
      'pathfinding',
      'عدو',
      'أعداء',
      'وحش',
      'وحوش',
      'مطاردة',
      'يطارد',
      'تطارد',
      'يطاردون',
      'دورية',
    ],
  },
  {
    lib: 'hud',
    skill: 'craftkit.pixi-hud',
    words: [
      'hud',
      'health bar',
      'health points',
      'hp',
      'xp',
      'mana',
      'energy bar',
      'scoreboard',
      'score board',
      'extra lives',
      'lives left',
      'شريط الصحة',
      'نقاط الصحة',
      'شريط الطاقة',
      'نقاط الخبرة',
      'واجهة اللعبة',
      'لوحة النقاط',
      'عداد الأرواح',
    ],
  },
  {
    lib: 'audio',
    skill: 'craftkit.pixi-audio',
    words: [
      'sound',
      'sounds',
      'sfx',
      'music',
      'audio',
      'soundtrack',
      'chiptune',
      'صوت',
      'أصوات',
      'موسيقى',
      'مؤثرات صوتية',
    ],
  },
];
