<?php
namespace Bolt\Extension\CND\ImageService\Field;

use Bolt\Extension\CND\ImageService\Image;
use Bolt\Storage\EntityManager;
use Bolt\Storage\Field\Type\FieldTypeBase;
use Bolt\Storage\QuerySet;

class ImageServiceField extends FieldTypeBase
{
    public function getName(){
        return 'imageservice';
    }

    public function getStorageType(){
        return 'text';
    }

    public function getStorageOptions()
    {
        return ['notnull' => false];
    }    
    
    public function getTemplate(){
        return '_' . $this->getName() . '.twig';
    }

    public function persist(QuerySet $queries, $entity, EntityManager $em = null){
        $key = $this->mapping['fieldname'];
        $qb = $queries->getPrimary();
        $value = $entity->get($key);

        // Try to convert to image and back to validate
        $value = json_decode($value, true);
        $image = Image::create($value);
        $value = json_encode($image, true);

        $qb->setValue($key, ':' . $key);
        $qb->set($key, ':' . $key);
        $qb->setParameter($key, (string)$value);
    }

    public function hydrate($data, $entity){
        $key = $this->mapping['fieldname'];
        $value = isset($data[$key]) ? $data[$key] : null;

        // Try to convert to image
        $value = json_decode($value, true);
        $value = $value ? Image::create($value) : null;

        $this->set($entity, $value);
    }

}
