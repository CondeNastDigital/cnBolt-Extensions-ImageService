<?php
namespace Bolt\Extension\CND\ImageService\Field;

use Bolt\Storage\EntityManager;
use Bolt\Storage\Field\Type\FieldTypeBase;
use Bolt\Storage\QuerySet;

class ImageServiceListField extends FieldTypeBase
{
    public static $default = ["items" => []];

    public function getName(){
        return 'imageservicelist';
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

        // Validate and format the input json
        $value = json_decode($value, true);

        $value = is_array($value) ? $value + self::$default : self::$default;
        foreach($value["items"] as &$item)
            $item = is_array($item) ? $item + ImageServiceField::$default : ImageServiceField::$default;

        $value = json_encode($value);

        $qb->setValue($key, ':' . $key);
        $qb->set($key, ':' . $key);
        $qb->setParameter($key, (string)$value);
    }

    public function hydrate($data, $entity){
        $key = $this->mapping['fieldname'];
        $value = isset($data[$key]) ? $data[$key] : null;

        $value = json_decode($value, true);

        $this->set($entity, $value);
    }

    public function validateValue(array $value){

        $value = is_array($value) ? $value + self::$default : self::$default;
        foreach($value["items"] as &$item)
            $item = ImageServiceField::validateValue($value);


    }

}