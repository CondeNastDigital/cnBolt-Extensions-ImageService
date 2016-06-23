<?php
namespace Bolt\Extension\CND\ImageService\Field;

use Bolt\Storage\EntityManager;
use Bolt\Storage\Field\Type\FieldTypeBase;
use Bolt\Storage\QuerySet;

class ImageServiceField extends FieldTypeBase
{
    public static $default = ["imagekey" => false, "service" => false, "attributes" => [], "options" => []];

    public function getName(){
        return 'imageservice';
    }

    public function getStorageType(){
        return 'text';
    }

    public function getStorageOptions(){
        return [
            'default' => ''
        ];
    }

    public function getTemplate(){
        return '_' . $this->getName() . '.twig';
    }

    public function persist(QuerySet $queries, $entity, EntityManager $em = null){
        $key = $this->mapping['fieldname'];
        $qb = $queries->getPrimary();
        $value = $entity->get($key);

        $value = json_decode($value, true);
        $value = self::validateValue($value);
        $value = json_encode($value, true);

        $qb->setValue($key, ':' . $key);
        $qb->set($key, ':' . $key);
        $qb->setParameter($key, (string)$value);
    }

    public function hydrate($data, $entity){
        $key = $this->mapping['fieldname'];
        $value = isset($data[$key]) ? $data[$key] : null;

        $value = json_decode($value, true);
        $value = self::validateValue($value);

        $this->set($entity, $value);
    }

    public static function validateValue(array $value){

        return is_array($value) ? $value + self::$default : self::$default;
    }

}