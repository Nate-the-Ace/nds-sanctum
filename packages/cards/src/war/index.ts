import type { CardDef } from '@sanctum/engine';
import berserkerBlade from './berserkerBlade';
import berserkers from './berserkers';
import bloodlust from './bloodlust';
import dragonSlayer from './dragonSlayer';
import fireball from './fireball';
import flamingSword from './flamingSword';
import goodOfTheMany from './goodOfTheMany';
import legionnaires from './legionnaires';
import ngozisWay from './ngozisWay';
import palisade from './palisade';
import plains from './plains';
import rainOfArrows from './rainOfArrows';
import scorchedEarth from './scorchedEarth';
import shatteringBlow from './shatteringBlow';
import swashbuckler from './swashbuckler';
import volcano from './volcano';
import warDrums from './warDrums';

export const warCards: CardDef[] = [
  flamingSword, bloodlust, legionnaires, ngozisWay, palisade, warDrums, swashbuckler,
  fireball, goodOfTheMany, plains, volcano, scorchedEarth, dragonSlayer,
  berserkerBlade, berserkers, rainOfArrows, shatteringBlow,
];
