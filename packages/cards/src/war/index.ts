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
import thermiteDamage from './thermiteDamage';
import thermites from './thermites';
import volcano from './volcano';
import veteran from './veteran';
import marksman from './marksman';
import fieldSurgery from './fieldSurgery';
import fieldSurgeryScar from './fieldSurgeryScar';
import warDrums from './warDrums';
import pointOfClarity from './pointOfClarity';
import callToArms from './callToArms';

export const warCards: CardDef[] = [
  flamingSword, bloodlust, legionnaires, ngozisWay, palisade, warDrums, swashbuckler,
  fireball, goodOfTheMany, plains, volcano, scorchedEarth, dragonSlayer,
  berserkerBlade, berserkers, rainOfArrows, shatteringBlow,
  thermites, thermiteDamage,
  veteran, marksman, fieldSurgery, fieldSurgeryScar,
  pointOfClarity, callToArms,
];
