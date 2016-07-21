<?php
namespace Bolt\Extension\CND\ImageService\Field;

use Bolt\Extension\CND\ImageService\Image;
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
            'default' => []
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
        foreach($value["items"] as &$item)
            $item = Image::create($item);
        $value = json_encode($value);

        $qb->setValue($key, ':' . $key);
        $qb->set($key, ':' . $key);
        $qb->setParameter($key, (string)$value);
    }

    public function hydrate($data, $entity){
        $key = $this->mapping['fieldname'];
        $value = isset($data[$key]) ? $data[$key] : null;

        $value = json_decode($value, true);
        foreach($value["items"] as &$item)
            $item = Image::create($item);

        $this->set($entity, $value);
    }

}